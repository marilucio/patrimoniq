function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailFrame(input: {
  eyebrow: string;
  title: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  body: string[];
  footer?: string[];
}) {
  const eyebrow = escapeHtml(input.eyebrow);
  const title = escapeHtml(input.title);
  const intro = escapeHtml(input.intro);
  const footer = input.footer ?? [
    "Se nao foi voce, ignore esta mensagem.",
    "Equipe Patrimoniq"
  ];

  return `
    <div style="font-family:Aptos,'Segoe UI',sans-serif;background:#f3f5fb;padding:32px;color:#162133;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;padding:32px;border:1px solid #d8dfeb;box-shadow:0 24px 48px rgba(22,33,51,0.08);">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;">
          <div style="width:48px;height:48px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#0f766e,#183b69);color:#fff;font-weight:700;">P</div>
          <div>
            <strong style="display:block;font-size:16px;">Patrimoniq</strong>
            <span style="color:#617186;">Financas pessoais com clareza</span>
          </div>
        </div>
        <span style="display:inline-block;margin-bottom:12px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;">${eyebrow}</span>
        <h1 style="margin:0 0 14px;font-size:32px;line-height:1.05;color:#162133;">${title}</h1>
        <p style="margin:0 0 22px;color:#516174;font-size:16px;line-height:1.6;">${intro}</p>
        ${
          input.ctaLabel && input.ctaUrl
            ? `<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:14px 20px;border-radius:999px;background:linear-gradient(135deg,#0f766e,#183b69);color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(input.ctaLabel)}</a>`
            : ""
        }
        <div style="display:grid;gap:14px;margin:${input.ctaLabel && input.ctaUrl ? "26px" : "0"} 0 0;">
          ${input.body
            .map(
              (paragraph) =>
                `<p style="margin:0;color:#516174;font-size:15px;line-height:1.7;">${paragraph}</p>`
            )
            .join("")}
        </div>
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e6ebf3;display:grid;gap:8px;">
          ${footer
            .map(
              (paragraph) =>
                `<p style="margin:0;color:#7a8798;font-size:13px;line-height:1.6;">${escapeHtml(paragraph)}</p>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

export function passwordResetEmailTemplate(input: {
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const fullName = escapeHtml(input.fullName);
  const resetUrl = escapeHtml(input.resetUrl);

  return {
    subject: "Redefina sua senha no Patrimoniq",
    text: [
      `Oi, ${input.fullName}.`,
      "",
      "Recebemos um pedido para redefinir sua senha no Patrimoniq.",
      `Use o link abaixo nas proximas ${input.expiresInMinutes} minutos:`,
      input.resetUrl,
      "",
      "Se voce nao solicitou essa troca, pode ignorar este e-mail.",
      "",
      "Equipe Patrimoniq"
    ].join("\n"),
    html: renderEmailFrame({
      eyebrow: "Seguranca da conta",
      title: `Redefina sua senha, ${fullName}`,
      intro:
        `Recebemos um pedido para trocar a senha da sua conta. Este link expira em ${input.expiresInMinutes} minutos.`,
      ctaLabel: "Criar nova senha",
      ctaUrl: resetUrl,
      body: [
        "Se o botao nao abrir, copie e cole o link abaixo no navegador:",
        `<span style="word-break:break-all;color:#183b69;">${resetUrl}</span>`
      ],
      footer: [
        "Se voce nao solicitou essa troca, ignore esta mensagem.",
        "Para sua seguranca, o link so pode ser usado uma vez."
      ]
    })
  };
}

export function welcomeEmailTemplate(input: {
  fullName: string;
  loginUrl: string;
}) {
  return {
    subject: "Sua conta no Patrimoniq esta pronta",
    text: [
      `Oi, ${input.fullName}.`,
      "",
      "Sua conta foi criada com sucesso.",
      "Agora voce ja pode entrar e organizar sua vida financeira com clareza.",
      input.loginUrl,
      "",
      "Equipe Patrimoniq"
    ].join("\n"),
    html: renderEmailFrame({
      eyebrow: "Conta criada",
      title: `Bem-vindo ao Patrimoniq, ${escapeHtml(input.fullName)}`,
      intro:
        "Sua conta ja esta pronta. Agora voce pode entrar, registrar suas movimentacoes e acompanhar seu dinheiro com menos ruido.",
      ctaLabel: "Entrar no Patrimoniq",
      ctaUrl: input.loginUrl,
      body: [
        "Seu ambiente individual ja nasce com categorias padrao para acelerar o primeiro uso.",
        "Se este cadastro nao foi feito por voce, responda este e-mail ou altere sua senha imediatamente."
      ],
      footer: [
        "Este e um e-mail transacional de acesso e seguranca.",
        "Equipe Patrimoniq"
      ]
    })
  };
}

export function smtpTestEmailTemplate(input: {
  fullName: string;
  stage: string;
  appUrl: string;
}) {
  return {
    subject: "Teste de e-mail do Patrimoniq",
    text: [
      `Oi, ${input.fullName}.`,
      "",
      "Este e um teste do envio transacional do Patrimoniq.",
      `Ambiente: ${input.stage}`,
      `Acesse: ${input.appUrl}`,
      "",
      "Se voce recebeu esta mensagem, o SMTP real esta funcionando."
    ].join("\n"),
    html: renderEmailFrame({
      eyebrow: "Diagnostico de e-mail",
      title: `SMTP ativo para ${escapeHtml(input.fullName)}`,
      intro:
        "Este e um disparo de validacao do ambiente beta. Se chegou na sua caixa, o envio transacional principal esta operacional.",
      ctaLabel: "Abrir Patrimoniq",
      ctaUrl: input.appUrl,
      body: [
        `Ambiente atual: <strong>${escapeHtml(input.stage)}</strong>.`,
        "Use este teste para confirmar recuperacao de senha e outros avisos essenciais antes de abrir o beta."
      ],
      footer: [
        "Este e um e-mail tecnico de validacao do ambiente.",
        "Equipe Patrimoniq"
      ]
    })
  };
}

export function feedbackSubmissionEmailTemplate(input: {
  fullName: string;
  email: string;
  category: string;
  pagePath: string;
  message: string;
  stage: string;
}) {
  return {
    subject: `Novo feedback beta do Patrimoniq: ${input.category}`,
    text: [
      `Usuario: ${input.fullName}`,
      `E-mail: ${input.email}`,
      `Categoria: ${input.category}`,
      `Tela: ${input.pagePath}`,
      `Ambiente: ${input.stage}`,
      "",
      input.message
    ].join("\n"),
    html: renderEmailFrame({
      eyebrow: "Feedback beta",
      title: `Novo feedback em ${escapeHtml(input.category)}`,
      intro:
        "Um usuario beta enviou um relato direto do aplicativo. Use este contexto para priorizar o ajuste correto.",
      body: [
        `<strong>Usuario:</strong> ${escapeHtml(input.fullName)} (${escapeHtml(input.email)})`,
        `<strong>Tela:</strong> ${escapeHtml(input.pagePath)}`,
        `<strong>Ambiente:</strong> ${escapeHtml(input.stage)}`,
        `<strong>Mensagem:</strong><br /><span style="white-space:pre-wrap;">${escapeHtml(input.message)}</span>`
      ],
      footer: [
        "Este e um e-mail operacional de beta.",
        "Equipe Patrimoniq"
      ]
    })
  };
}
