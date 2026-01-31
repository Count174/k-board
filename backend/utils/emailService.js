const nodemailer = require('nodemailer');

/**
 * Сервис для отправки email
 * 
 * Настройка через переменные окружения:
 * - SMTP_HOST - хост SMTP сервера (например, smtp.gmail.com)
 * - SMTP_PORT - порт (обычно 587 для TLS, 465 для SSL)
 * - SMTP_SECURE - true для SSL (порт 465), false для TLS (порт 587)
 * - SMTP_USER - email для авторизации
 * - SMTP_PASS - пароль или app password
 * - EMAIL_FROM - отправитель (обычно тот же SMTP_USER)
 */

let transporter = null;

function initTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;

  if (!host || !user || !pass) {
    console.warn('⚠️ Email не настроен. Установите SMTP_HOST, SMTP_USER, SMTP_PASS в .env');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

/**
 * Отправить email
 */
async function sendEmail({ to, subject, html, text }) {
  const transport = initTransporter();
  if (!transport) {
    console.error('❌ Email transporter не инициализирован');
    return { success: false, error: 'Email не настроен' };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  try {
    const info = await transport.sendMail({
      from: `"K-Board" <${from}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Убираем HTML теги для текстовой версии
    });

    console.log(`✅ Email отправлен: ${to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Ошибка отправки email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить письмо для восстановления пароля
 */
async function sendPasswordResetEmail(email, resetToken, resetUrl) {
  const subject = 'Восстановление пароля K-Board';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .button:hover { background-color: #0056b3; }
        .code { font-family: monospace; font-size: 18px; background: #f4f4f4; padding: 10px; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Восстановление пароля</h2>
        <p>Вы запросили восстановление пароля для вашего аккаунта K-Board.</p>
        <p>Нажмите на кнопку ниже, чтобы сбросить пароль:</p>
        <a href="${resetUrl}" class="button">Сбросить пароль</a>
        <p>Или скопируйте эту ссылку в браузер:</p>
        <div class="code">${resetUrl}</div>
        <p>Ссылка действительна в течение 1 часа.</p>
        <p>Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>
        <div class="footer">
          <p>С уважением,<br>Команда K-Board</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Отправить письмо об успешной смене пароля
 */
async function sendPasswordChangedEmail(email) {
  const subject = 'Пароль изменен - K-Board';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .alert { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Пароль успешно изменен</h2>
        <div class="alert">
          <strong>Ваш пароль был успешно изменен.</strong>
        </div>
        <p>Если это были не вы, немедленно свяжитесь с поддержкой.</p>
        <div class="footer">
          <p>С уважением,<br>Команда K-Board</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  initTransporter,
};
