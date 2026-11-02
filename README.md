# Museu Dadá 3D

Corredor de museu em 3D, em primeira pessoa. **WASD** para andar, rato para olhar, **E** para ver a descrição do quadro, **Shift** para correr, **Esc** para pausar.

## Mudar os quadros
1. Põe as fotos em `obras/` (`01.jpg` ... `06.jpg`).
2. Edita `obras.js` com título, artista, ano e descrição de cada obra.

O corredor ajusta-se ao número de obras na lista.

## Testar localmente
```bash
python3 -m http.server 8000
```
Abre http://localhost:8000
