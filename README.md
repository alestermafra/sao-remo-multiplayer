# 🛵 São Remo Express 3D (Multiplayer Web)

Jogo 3D de mundo aberto low-poly ambientado na comunidade **São Remo** (vizinha da USP em São Paulo).
O jogo roda direto pelo navegador sem instalar nada, feito com foco total em desempenho no celular via link.

---

## 🎮 Funcionalidades Principais

1. **Locomoção Dupla:**
   - **A pé:** Suba vielas, escadões e ladeiras livremente.
   - **Veículo (Bike ou Motinha 160cc):** Aperte o botão **Montar / Desmontar** (`E`/`F` no PC ou toque no celular) para subir na bike e acelerar.
2. **Profissão: Entregador 📦:**
   - Colete marmitex, pizzas e encomendas nos comércios da São Remo (Boteco do Zé, Padaria Estrela, Mercadinho Central).
   - Entregue nas lajes e residências marcadas com o feixe de luz verde.
   - Ganhe dinheiro a cada entrega e acumule para comprar a **Motinha 160cc**!
3. **Multiplayer em Tempo Real (WebSockets):**
   - Outros jogadores aparecem no mesmo mapa em tempo real.
   - Buzine com som característico ("Bi-Bi!").
   - **Chat de Texto com Balões 3D:** Mensagens aparecem em balões de gibi acima da cabeça dos jogadores e no feed lateral.
   - Botões de frases rápidas ("Salve quebrada!", "Corta o giro!", "Passa o pix!").
4. **Cenário da São Remo:**
   - Casas em alvenaria e tijolo aparente.
   - Lajes com as tradicionais **caixas d'água azuis**.
   - Muro da USP com iluminação.
   - Campinho de terra batida com traves de futebol.
   - Pipas coloridas voando no céu.
5. **Controles Mobile (Modo Horizontal / Landscape):**
   - Analógico virtual na mão esquerda.
   - Pedais de Acelerar, Freio/Ré, Montar e Buzina na mão direita.

---

## 🚀 Como Rodar Localmente

### 1. Iniciar o jogo em desenvolvimento:
```bash
npm run dev
```
O servidor Node e o Vite rodarão simultaneamente:
- **Cliente:** `http://localhost:3000` (ou o IP da sua rede local no celular, ex: `http://192.168.x.x:3000`)
- **Servidor WebSocket:** `http://localhost:3001`

### 2. Jogar pelo Celular na mesma rede Wi-Fi:
O Vite já está configurado com `--host 0.0.0.0`. Basta descobrir seu IP local (ex: `192.168.1.15`) e abrir `http://192.168.1.15:3000` no navegador do celular!

---

## 🌐 Como Colocar na Internet com Link Grátis

Para compartilhar o link com quem você quiser jogar:

### Opção 1: Render.com (Gratuito)
1. Crie uma conta no [Render](https://render.com).
2. Conecte este repositório Git.
3. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. O Render gerará uma URL pública HTTPS (ex: `https://sao-remo-express.onrender.com`). Qualquer pessoa no celular ou PC pode abrir e jogar junta!

### Opção 2: Railway.app / Fly.io
Mesmo processo: o comando `npm start` inicia o servidor `server/server.js`, que serve tanto o frontend compilado em `dist/` quanto os WebSockets na mesma porta.

