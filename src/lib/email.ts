// Use onboarding@resend.dev para testes; configure RESEND_FROM_EMAIL com domínio verificado em produção
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function sendVerificationCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY não configurada. Código seria:", code);
    return { ok: true, skipped: true };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Seu código de verificação - Fiscal Flow",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #059669;">Fiscal Flow</h2>
        <p>Olá,</p>
        <p>Use o código abaixo para confirmar seu cadastro:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">${code}</p>
        <p style="color: #64748b; font-size: 14px;">Este código expira em 10 minutos.</p>
        <p style="color: #64748b; font-size: 14px;">Se você não solicitou este cadastro, ignore este e-mail.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Erro ao enviar email:", error);
    throw new Error("Falha ao enviar e-mail de verificação");
  }
  return { ok: true };
}
