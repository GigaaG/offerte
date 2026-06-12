# Autoreset offertecalculator

Interne reviewversie van een moderne TypeScript webapp voor indicatieve ritoffertes.

## Configuratie

Kopieer `.env.example` naar `.env.local` en vul indien beschikbaar een HERE sleutel in:

```bash
VITE_HERE_API_KEY=...
```

Let op: bij een statische frontend worden `VITE_*` variabelen naar de browser gebundeld. Gebruik voor productie bij voorkeur een server/proxy voor HERE calls. Zonder sleutel draait de app in demo/fallbackmodus met voorbeelddata voor Hoorn → Amsterdam → München.

## Commands

```bash
npm install
npm run dev
npm run build
```
