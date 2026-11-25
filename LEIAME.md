# Site do aniversário — fotos, vídeos e recadinhos

Os convidados leem o QR code da mesa, abrem o site e mandam fotos, vídeos e mensagens.
Tudo aparece num **mural ao vivo** e fica salvo numa **pasta do Google Drive**.

```
site/            → o site (hospedar na internet)
  config.js      → ÚNICO arquivo que você precisa editar
  index.html     → página principal (envio + mural)
  index.html?telao → modo telão (slideshow para TV/projetor, com QR code)
  qrcode.html    → cartões com QR code para imprimir (4 por folha A4)
apps-script/
  Code.gs        → "servidor" grátis que salva tudo no seu Google Drive
```

---

## Passo 1 — Criar o "servidor" no Google (10 min)

> **Use uma conta Gmail pessoal.** Contas de empresa/escola costumam bloquear
> o compartilhamento "qualquer pessoa com o link", e aí as fotos não aparecem no mural.

1. Acesse <https://script.google.com> → **Novo projeto**.
2. Apague o conteúdo e cole todo o arquivo `apps-script/Code.gs`. Salve (Ctrl+S).
3. No topo, escolha a função **`setup`** e clique em **Executar**.
   - Vai pedir autorização → escolha sua conta → *Avançado* → *Acessar projeto (não seguro)* → *Permitir*.
     (O aviso aparece porque o script é seu e não foi verificado pelo Google; é normal.)
   - No log aparecem os links da **pasta** e da **planilha** criadas no seu Drive.
4. Clique em **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

> Se você alterar o `Code.gs` depois, use **Implantar → Gerenciar implantações → editar (lápis) →
> Versão: Nova versão**, para manter a mesma URL.

## Passo 2 — Configurar o site

Abra `site/config.js` e preencha:

```js
nome: "Maria",                       // nome da aniversariante
data: "14 de dezembro de 2026",      // opcional
apiUrl: "https://script.google.com/macros/s/XXXX/exec",
siteUrl: "https://festa-da-maria.netlify.app",  // preencha depois do passo 3
```

## Passo 3 — Colocar o site no ar (grátis)

Opção mais fácil — **Netlify Drop**:
1. Acesse <https://app.netlify.com/drop> e crie uma conta grátis.
2. Arraste a pasta **`site`** para a página. Pronto, você ganha um endereço.
3. Em *Site configuration → Change site name* dá para escolher um nome bonito
   (ex.: `festa-da-maria.netlify.app`).
4. Coloque esse endereço no `siteUrl` do `config.js` e arraste a pasta de novo
   (*Deploys → arraste para atualizar*).

(Também funciona no GitHub Pages, Vercel ou qualquer hospedagem de site estático.)

## Passo 4 — Testar antes da festa

- Abra o site no celular, mande uma foto, um vídeo curto e uma mensagem.
- Confira se apareceram no mural e na pasta do Drive.
- Foto recém-enviada pode levar alguns segundos para aparecer para os outros
  (o Google gera a miniatura); vídeos podem demorar uns minutos para tocar.

## Passo 5 — QR codes e telão

- **Cartões das mesas:** abra `https://SEU-SITE/qrcode.html` e clique em *Imprimir*.
- **Telão:** num notebook ligado à TV, abra `https://SEU-SITE/?telao` e deixe em tela cheia (F11).
  Ele passa as fotos e recados como slideshow, mostrando primeiro o que acabou de chegar,
  com o QR code no canto.

---

## Dúvidas comuns

**Como tirar algo do mural?** Abra a planilha *Mural do aniversário* (dentro da pasta no Drive)
e apague a linha. Some do mural em alguns segundos.

**Onde ficam os arquivos?** Na pasta *Aniversário - fotos, vídeos e mensagens* do seu Drive,
com nome `data hora - nome de quem enviou`. Mensagens ficam na planilha.

**Limites:** até 250 MB por arquivo (vídeos de alguns minutos). Fotos grandes são reduzidas para
2560 px antes do envio, para não pesar no 4G da festa. O plano grátis do Google tem 15 GB.

**Testar sem configurar nada:** com `apiUrl` vazio o site roda em *modo demonstração*
(mostra um aviso amarelo e nada é salvo).
