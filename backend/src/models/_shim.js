/**
 * src/models/_shim.js
 * A thin Mongoose-compatible layer over Sequelize models.
 *
 * The application was written against the Mongoose API. Rather than rewrite
 * every query when moving to MySQL, this shim gives each Sequelize model the
 * subset of the Mongoose Model/Query API the codebase actually uses:
 *   statics:  find, findOne, findById, create, findByIdAndUpdate,
 *             findOneAndUpdate, findByIdAndDelete, findOneAndDelete,
 *             countDocuments, updateOne, deleteMany
 *   query chain: .populate(path,select) .select(str) .sort(arg) .limit(n) .lean()
 *   operators: $ne $in $nin $gte $gt $lte $lt $or $and $exists $regex
 *
 * NOT emulated: .aggregate() and .cursor() — those call sites are rewritten by hand.
 *
 * Association aliases are set equal to the foreign-key field name (e.g. Result
 * belongsTo User as 'studentId') so that .populate('studentId') replaces the id
 * string with the related object, matching Mongoose semantics.
 */

const { Op } = require('sequelize');

const isPlainOpObject = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) &&
  Object.keys(v).some((k) => k.startsWith('$'));

const OP_MAP = {
  $ne: Op.ne, $in: Op.in, $nin: Op.notIn,
  $gte: Op.gte, $gt: Op.gt, $lte: Op.lte, $lt: Op.lt,
};

function translateValue(val) {
  if (isPlainOpObject(val)) {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '$exists') {
        out[v ? Op.ne : Op.is] = null;
      } else if (k === '$regex') {
        out[Op.like] = `%${String(v).replace(/^\^|\$$/g, '')}%`;
      } else if (OP_MAP[k]) {
        out[OP_MAP[k]] = v;
      }
    }
    return out;
  }
  return val; // equality
}

function translateFilter(filter = {}) {
  const where = {};
  for (const [key, val] of Object.entries(filter)) {
    if (key === '$or') {
      where[Op.or] = val.map(translateFilter);
    } else if (key === '$and') {
      where[Op.and] = val.map(translateFilter);
    } else {
      where[key] = translateValue(val);
    }
  }
  return where;
}

function translateSort(arg) {
  if (!arg) return undefined;
  if (typeof arg === 'string') {
    return arg.split(/\s+/).filter(Boolean).map((tok) =>
      tok.startsWith('-') ? [tok.slice(1), 'DESC'] : [tok, 'ASC']
    );
  }
  // object form { field: 1 | -1 }
  return Object.entries(arg).map(([f, dir]) => [f, dir === -1 || dir === '-1' ? 'DESC' : 'ASC']);
}

class Query {
  constructor(model, method, filter, projection) {
    this.model = model;
    this.method = method; // 'findAll' | 'findOne'
    this._where = translateFilter(filter || {});
    this._includes = [];
    this._attributes = undefined;
    this._order = undefined;
    this._limit = undefined;
    this._lean = false;
    if (projection) this._applyProjection(projection);
  }

  _applyProjection(proj) {
    // Mongoose second-arg projection: { field: 1, ... }
    const inc = Object.entries(proj).filter(([, v]) => v).map(([k]) => k);
    if (inc.length) {
      if (!inc.includes('_id')) inc.push('_id');
      this._attributes = inc;
    }
  }

  populate(path, select) {
    const map = this.model._populateMap || {};
    const alias = map[path] || path;
    const inc = { association: alias, required: false };
    if (select) {
      const attrs = String(select).split(/\s+/).filter(Boolean);
      if (!attrs.includes('_id')) attrs.push('_id');
      inc.attributes = attrs;
    }
    // remember field→alias so we can remap the nested object back onto <path>
    this._includes.push(inc);
    this._popPaths = this._popPaths || [];
    this._popPaths.push({ path, alias });
    return this;
  }

  select(str) {
    const tokens = String(str).split(/\s+/).filter(Boolean);
    if (tokens.length && tokens.every((t) => t.startsWith('-'))) {
      this._attributes = { exclude: tokens.map((t) => t.slice(1)) };
    } else {
      const inc = tokens.filter((t) => !t.startsWith('-'));
      if (!inc.includes('_id')) inc.push('_id');
      this._attributes = inc;
    }
    return this;
  }

  sort(arg) { this._order = translateSort(arg); return this; }
  limit(n) { this._limit = n; return this; }
  lean() { this._lean = true; return this; }

  async exec() {
    const options = { where: this._where };
    if (this._attributes) options.attributes = this._attributes;
    if (this._includes.length) options.include = this._includes;
    if (this._order) options.order = this._order;
    if (this._limit != null) options.limit = this._limit;

    const native = this.method === 'findOne' ? this.model.sequelizeFindOne : this.model.sequelizeFindAll;
    const res = await native(options);

    // When associations are populated we always return plain objects and remap
    // the aliased nested object back onto the original field name (Mongoose
    // replaces the id with the populated doc). No code .save()s a populated doc.
    const hasPop = this._popPaths && this._popPaths.length;
    if (!this._lean && !hasPop) return res;

    const toPlain = (r) => {
      if (!r) return r;
      const obj = r.get ? r.get({ plain: true }) : r;
      if (hasPop) {
        for (const { path, alias } of this._popPaths) {
          if (alias !== path) {
            obj[path] = obj[alias] === undefined ? null : obj[alias];
            delete obj[alias];
          }
        }
      }
      return obj;
    };

    if (Array.isArray(res)) return res.map(toPlain);
    return toPlain(res);
  }

  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(cb) { return this.exec().catch(cb); }
  finally(cb) { return this.exec().finally(cb); }
}

function translateError(e) {
  if (e && (e.name === 'SequelizeUniqueConstraintError')) {
    e.code = 11000; // mimic Mongoose duplicate-key error code
  }
  return e;
}

function stripOperators(filter = {}) {
  const out = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k.startsWith('$')) continue;
    if (!isPlainOpObject(v)) out[k] = v;
  }
  return out;
}

function applyUpdate(inst, update = {}) {
  const hasOps = Object.keys(update).some((k) => k.startsWith('$'));
  if (!hasOps) {
    for (const [k, v] of Object.entries(update)) setField(inst, k, v);
    return;
  }
  if (update.$set) for (const [k, v] of Object.entries(update.$set)) setField(inst, k, v);
  if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) setField(inst, k, (inst.get(k) || 0) + v);
  if (update.$addToSet) {
    for (const [k, v] of Object.entries(update.$addToSet)) {
      const arr = Array.isArray(inst.get(k)) ? [...inst.get(k)] : [];
      const val = String(v);
      if (!arr.map(String).includes(val)) arr.push(v);
      setField(inst, k, arr);
    }
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      const arr = Array.isArray(inst.get(k)) ? [...inst.get(k)] : [];
      arr.push(v);
      setField(inst, k, arr);
    }
  }
}

function setField(inst, key, val) {
  inst.set(key, val);
  // Ensure JSON/array column mutations are always persisted
  inst.changed(key, true);
}

/**
 * Attach the Mongoose-compatible static API to a Sequelize model.
 */
function applyShim(Model) {
  // Capture native Sequelize finders before overriding (Query.exec uses these).
  Model.sequelizeFindOne = Model.findOne.bind(Model);
  Model.sequelizeFindAll = Model.findAll.bind(Model);

  Model.find = (filter, projection) => new Query(Model, 'findAll', filter, projection);
  Model.findOne = (filter, projection) => new Query(Model, 'findOne', filter, projection);
  Model.findById = (id, projection) => new Query(Model, 'findOne', { _id: id }, projection);

  // Capture Sequelize's native create before overriding, so we can reuse it
  const origCreate = Model.create.bind(Model);
  Model.sequelizeCreate = origCreate;
  Model.create = async (data) => {
    try {
      return await origCreate(data);
    } catch (e) {
      throw translateError(e);
    }
  };

  // NOTE: Sequelize's findByPk misbehaves when the PK attribute is named '_id',
  // so we always query with an explicit { _id } where clause.
  Model.findByIdAndUpdate = async (id, update, opts = {}) => {
    const inst = await Model.sequelizeFindOne({ where: { _id: id } });
    if (!inst) return null;
    applyUpdate(inst, update);
    try { await inst.save(); } catch (e) { throw translateError(e); }
    return opts.lean ? inst.get({ plain: true }) : inst;
  };

  Model.findOneAndUpdate = async (filter, update, opts = {}) => {
    const inst = await Model.sequelizeFindOne({ where: translateFilter(filter) });
    if (inst) {
      applyUpdate(inst, update);
      try { await inst.save(); } catch (e) { throw translateError(e); }
      return opts.lean ? inst.get({ plain: true }) : inst;
    }
    if (opts.upsert) {
      const seed = { ...stripOperators(filter) };
      const hasOps = Object.keys(update).some((k) => k.startsWith('$'));
      Object.assign(seed, hasOps ? (update.$set || {}) : update);
      try { return await Model.sequelizeCreate(seed); } catch (e) { throw translateError(e); }
    }
    return null;
  };

  Model.findByIdAndDelete = async (id) => {
    const inst = await Model.sequelizeFindOne({ where: { _id: id } });
    if (!inst) return null;
    await inst.destroy();
    return inst;
  };

  Model.findOneAndDelete = async (filter) => {
    const inst = await Model.sequelizeFindOne({ where: translateFilter(filter) });
    if (!inst) return null;
    await inst.destroy();
    return inst;
  };

  Model.countDocuments = (filter = {}) => Model.count({ where: translateFilter(filter) });

  Model.updateOne = async (filter, update) => {
    const inst = await Model.sequelizeFindOne({ where: translateFilter(filter) });
    if (!inst) return { matchedCount: 0, modifiedCount: 0 };
    applyUpdate(inst, update);
    await inst.save();
    return { matchedCount: 1, modifiedCount: 1 };
  };

  Model.deleteMany = async (filter = {}) => {
    const n = await Model.destroy({ where: translateFilter(filter) });
    return { deletedCount: n };
  };

  return Model;
}

module.exports = { applyShim, translateFilter, translateSort, Query, Op };
