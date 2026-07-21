# Site de Controle de Aparelhos - IFTO Dianópolis

Este projeto é um site responsivo para o Instituto Federal Campus Dianópolis, desenvolvido para controlar o uso de aparelhos como retroprojetor e salas de informática.

## Recursos

- Login básico para servidores usando e-mail `@ifto.edu.br` e senha
- Cadastro de novo aparelho com status inicial
- Lista de aparelhos com status:
  - Disponível
  - Em uso
  - Em manutenção
- Reserva de horários livres para aparelhos disponíveis
- Perfil do servidor com edição de nome, telefone e senha

## Estrutura de arquivos

- `index.html`: interface principal
- `styles.css`: estilos responsivos
- `script.js`: lógica do aplicativo
- `api.js`: integração com backend
- `server.js`: servidor Express com autenticação JWT
- `package.json`: dependências do backend

## Como usar

1. Abra um terminal no diretório do projeto.
2. Execute `npm install` para instalar dependências.
3. Inicie o servidor com `npm start`.
4. Acesse `http://localhost:3000` no navegador.
5. Cadastre um servidor com e-mail `@ifto.edu.br`.
6. Adicione aparelhos na aba "Cadastro de aparelho".
7. Veja os aparelhos cadastrados e reserve horários livres.
8. Edite o perfil na aba "Perfil".

> Os dados são armazenados no SQLite local (`database.sqlite`) e a autenticação usa JWT.
