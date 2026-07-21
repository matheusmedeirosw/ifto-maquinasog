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
 - `package-lock.json`: dependências travadas

## Como usar

1. Abra um terminal no diretório do projeto.
2. Execute `npm install` para instalar dependências.
3. Inicie o servidor com `npm start`.
4. Acesse `http://localhost:3000` no navegador.
5. Cadastre um servidor com e-mail `@ifto.edu.br`.
6. Adicione aparelhos na aba "Cadastro de aparelho".
7. Veja os aparelhos cadastrados e reserve horários livres.
8. Edite o perfil na aba "Perfil".

> Observação sobre banco de dados

Este projeto já pode ser executado localmente com SQLite, mas para publicar em um serviço como Railway é recomendável usar PostgreSQL.

Para testar com PostgreSQL localmente crie um arquivo `.env` na raiz com:

```
DATABASE_URL=postgres://usuario:senha@localhost:5432/nomedb
JWT_SECRET=uma_chave_secreta
```

Instale dependências e execute:

```bash
npm install
npm start
```

Deploy no Railway (resumo):

1. Conecte sua conta GitHub no Railway e crie um novo projeto deployando o repositório.
2. Adicione o plugin "Postgres" no Railway (ele cria uma instância e define a variável `DATABASE_URL`).
3. O Railway fará `npm install` e `npm start` automaticamente.

Importante: o arquivo `database.sqlite` não será usado quando você rodar com PostgreSQL. Se já tiver dados no SQLite e quiser migrar para Postgres, exporte e importe manualmente.
