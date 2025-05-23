const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.MAIL,
    pass: process.env.MAIL_PASSWORD,
  },
});

const sendMail = (email, code, title, message) => {
  transporter.sendMail(
    {
      from: process.env.MAIL,
      to: email,
      subject: title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 10px; direction: rtl;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #2c3e50; font-size: 28px; font-weight: bold; margin: 0;">
              أكاديمية فقيه
            </h1>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #2c3e50; text-align: center; margin-bottom: 20px;">${title}</h2>
            <p style="color: #34495e; font-size: 16px; line-height: 1.6; margin-bottom: 20px; text-align: center;">${message}</p>
            <div style="background-color: #3498db; color: #ffffff; font-size: 24px; font-weight: bold; text-align: center; padding: 15px; border-radius: 5px; margin: 20px 0;">
              ${code}
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #95a5a6; font-size: 14px;">
            © ${new Date().getFullYear()} أكاديمية فقيه. جميع الحقوق محفوظة.
          </div>
        </div>
      `,
    },
    (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
        return false;
      } else {
        console.log("Email sent:", info.response);
        return true;
      }
    }
  );
};

const sendMailFromUserToTeam = (message) => {
  transporter.sendMail(
    {
      from: message.email,
      to: process.env.MAIL,
      subject: `رسالة من ${message.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 10px; direction: rtl;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #2c3e50; font-size: 28px; font-weight: bold; margin: 0;">
              أكاديمية فقيه
            </h1>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #3498db; text-align: center; margin-bottom: 30px;">رسالة جديدة من المستخدم</h2>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
              <strong style="color: #3498db; font-size: 18px;">الإسم:</strong>
              <span style="color: #2c3e50; font-size: 16px; display: block; margin-top: 5px;">${
                message.name
              }</span>
            </div>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
              <strong style="color: #3498db; font-size: 18px;">البريد الالكتروني:</strong>
              <a href="mailto:${
                message.email
              }" style="color: #2c3e50; font-size: 16px; display: block; margin-top: 5px; text-decoration: none;">${
        message.email
      }</a>
            </div>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
              <strong style="color: #3498db; font-size: 18px;">رقم الهاتف:</strong>
              <a href="tel:${
                message.phone
              }" style="color: #2c3e50; font-size: 16px; display: block; margin-top: 5px; text-decoration: none;">${
        message.phone
      }</a>
            </div>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
              <strong style="color: #3498db; font-size: 18px;">الرسالة:</strong>
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin-top: 10px;">${
                message.message
              }</p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #95a5a6; font-size: 14px;">
            © ${new Date().getFullYear()} أكاديمية فقيه. جميع الحقوق محفوظة.
          </div>
        </div>
      `,
    },
    (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
        return false;
      } else {
        console.log("Email sent:", info.response);
        return true;
      }
    }
  );
};

const sendWelcomeEmail = (email, username) => {
  const title = "مرحبًا بك في أكاديمية فقيه 👋";
  const message = `
    <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
      مرحبًا ${username}،
    </p>
    <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
      نود أن نرحب بك في أكاديمية فقيه! نحن سعداء بانضمامك إلينا ونتطلع إلى مساعدتك في رحلتك التعليمية.
    </p>
    <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
      يمكنك الآن الاستفادة من جميع الدورات والموارد التعليمية التي نقدمها  .
    </p>
    <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
      إذا كان لديك أي استفسارات أو تحتاج إلى مساعدة، فلا تتردد في التواصل معنا.
    </p>
    <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
      مع أطيب التمنيات،
    </p>
    <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
      فريق أكاديمية فقيه
    </p>
  `;

  const code = `<a href='www.faqeeh-academy.com' style="display:inline-block; color: white;">www.faqeeh-academy.com</a>`;

  sendMail(email, code, title, message);
};

module.exports = {
  sendMail,
  sendMailFromUserToTeam,
  sendWelcomeEmail,
};
