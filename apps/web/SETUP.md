# Chef IA — Frontend Setup

## Structure créée

```
apps/web/src/
├── api/
│   └── client.ts              # Client Axios avec intercepteurs JWT
├── auth/
│   ├── AuthContext.tsx         # Context React pour l'authentification
│   ├── AuthProvider.tsx        # Provider avec logique login/logout
│   └── ProtectedRoute.tsx     # Guard pour les routes privées
├── layouts/
│   └── DashboardLayout.tsx    # Layout principal (sidebar + header)
├── pages/
│   └── LoginPage.tsx          # Page de connexion
├── router.tsx                 # Configuration React Router
├── App.tsx                    # Point d'entrée (providers)
└── main.tsx                   # Bootstrap Vite
```

## Dépendances à installer

```bash
cd apps/web
npm install react-router-dom axios
npm install -D tailwindcss @tailwindcss/vite
```

## Lancer le projet

```bash
npm run dev
```

Le frontend tourne sur `http://localhost:5173` et proxy vers `http://localhost:3000`.
