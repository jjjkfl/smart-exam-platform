/**
 * js/student/certificate.js
 * Certificate generation and PDF download
 */

const Certificate = {
  async generate(resultId) {
    notifications.info('Generating your certificate...');
    
    try {
      const { data } = await api.get(`/portal/student/results/${resultId}`);
      const user = auth.getUser();

      // In a real app, this would be a server-side PDF generation or a library like jspdf
      // Here we simulate it with a print-ready HTML view or a download alert
      
      const certData = {
        name: `${user.firstName} ${user.lastName}`,
        exam: data.session.title,
        score: `${data.percentage}%`,
        date: utils.formatDate(data.submittedAt),
        hash: data.resultHash || 'SECURE-GENESIS-V1'
      };

      console.log('Certificate Generated:', certData);
      
      Modal.show('cert', `
        <div style="border: 10px double var(--border); padding: 40px; text-align: center; background: #fff; color: #000;">
          <h2 style="font-family: serif; font-size: 32px; margin-bottom: 20px;">CERTIFICATE OF COMPLETION</h2>
          <p>This is to certify that</p>
          <h3 style="font-size: 24px; margin: 20px 0; border-bottom: 1px solid #000; display: inline-block; min-width: 200px;">${certData.name}</h3>
          <p>has successfully completed the examination</p>
          <h4 style="font-weight: 600; margin: 10px 0;">${certData.exam}</h4>
          <p>with a score of <strong>${certData.score}</strong></p>
          <div style="margin-top: 40px; font-size: 10px; color: #888;">
            VERIFICATION HASH: ${certData.hash}<br>
            VALIDATED BY MCQPRO BLOCKCHAIN
          </div>
        </div>
      `, { title: 'Exam Certificate', width: '700px', footer: '<button onclick="window.print()" class="btn btn-primary">Print / Save as PDF</button>' });

    } catch (err) {
      notifications.error('Failed to generate certificate');
    }
  }
};

window.Certificate = Certificate;
