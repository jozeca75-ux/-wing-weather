# Wing Weather — Lagoa de Ibiraquera

Site que mostra se as condições estão boas para wing na Lagoa de Ibiraquera (Imbituba, SC).

- Dados: [Open-Meteo](https://open-meteo.com/) (gratuito, sem chave), condição atual, atualiza a cada 15 min.
- Regras: vento médio entre 12 e 30 nós (22 a 56 km/h), rajada até 35 nós e céu sem neblina, chuva forte ou trovoada.

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
