# golgoth-push

Serveur de notifications de fin de repos pour Golgoth (Vercel, Node 22).

- `POST /api/rest` `{ subscription, endAt, token, title, body }` : envoie la notification à `endAt`. Un nouvel appel pour le même abonnement remplace le précédent.
- `POST /api/cancel` `{ subscription }` : annule la notification en attente.
- `GET /api/key` : clé publique VAPID.
- `POST /api/test` `{ subscription }` : notification immédiate.

Rien n'est stocké au-delà d'une heure (cache d'exécution Vercel, une entrée par abonnement pendant un repos).

Variables d'environnement : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
