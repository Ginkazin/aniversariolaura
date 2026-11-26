// ============================================================
//  CONFIGURAÇÃO DA FESTA — edite só este arquivo
// ============================================================
window.FESTA = {
  // Nome da aniversariante (aparece no topo do site e no telão)
  nome: "Laurinha",

  // Data/local da festa (opcional — deixe "" para não mostrar)
  data: "29 de novembro de 2026",

  // URL do Apps Script (termina em /exec). Veja o LEIAME.md.
  // Enquanto estiver vazio, o site funciona em MODO DEMONSTRAÇÃO
  // (nada é salvo de verdade).
  apiUrl: "https://script.google.com/macros/s/AKfycbyEhxFGt80O3CrmDLN8SxWIWER3reZzQ3YME1DOt2n_LylK9rEUgrIqJR5mxqMV-kH_Fw/exec",

  // Endereço público do site (usado no QR code do telão e dos cartões).
  // Ex.: "https://festa-da-maria.netlify.app"
  siteUrl: "https://aniversariolaura-k9x4.netlify.app/",

  // De quantos em quantos segundos o mural busca novidades
  pollSeconds: 45,
};
