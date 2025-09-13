# API Gateway

Point d'entrée principal pour les microservices.

## Fonctionnalités

- ✅ Centralise les requêtes entrantes
- ✅ Proxy vers auth-service (port 3001)
- ✅ Gestion des erreurs centralisée
- ✅ Journalisation des requêtes
- ✅ Support CORS

## Démarrage

```bash
npm install
npm run start:dev
```

## Routes

- `GET/POST/PUT/DELETE /auth/*` → Proxifié vers auth-service

## Ports

- API Gateway: 3000
- Auth Service: 3001

## Extension future

D'autres microservices peuvent être ajoutés facilement en créant de nouveaux contrôleurs de proxy.
