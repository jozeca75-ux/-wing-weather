# Wing Weather — Lagoa de Ibiraquera

Site que mostra se as condições estão boas para wing na Lagoa de Ibiraquera (Imbituba, SC).

- Dados: [Open-Meteo](https://open-meteo.com/) (gratuito, sem chave), atualiza a cada 15 min.
  - Previsão: vento, rajada, direção, chuva e nuvens.
  - Satélite NOAA GOES-19: luz do sol medida a cada 10 min, usada para o céu durante o dia.
- Regras: 4 níveis (ótimo, bom, ruim, péssimo) para o vento e para o céu; vale o pior dos dois.
  - Vento: ótimo 15–22 nós (28–41 km/h); bom 12–15 ou 22–30 nós; ruim 8–12 nós; péssimo abaixo de 8, acima de 30 nós ou rajada acima de 35 nós.
  - Céu: ótimo ensolarado ou nuvem com sol; bom nublado; ruim chuva (fraca a forte) ou neblina; péssimo trovoada.

## Arquivos

- `index.html` — estrutura da página
- `style.css` — visual (fundos por condição de céu, fonte Jersey 15)
- `app.js` — busca a previsão e aplica as regras
- `assets/` — ícones e seta exportados do Figma
- `fonts/` — fonte Jersey 15 (licença SIL OFL)

## Testar sem depender da previsão

Abra a página com parâmetros de demonstração:

```
index.html?demo&vel=25&raj=30&dir=45&cod=2
```

- `vel` velocidade (km/h), `raj` rajada (km/h), `dir` direção em graus, `cod` código de tempo WMO
  (0 ensolarado, 2 nuvem com sol, 3 nublado, 61 chuva, 95 trovoada).
- `k` simula o satélite (índice de claridade de 0 a 1: 0.7 sol, 0.5 nuvem com sol, 0.2 nublado).
- `chuva` (mm), `nuvens`, `baixas`, `medias` (%) simulam a previsão.
