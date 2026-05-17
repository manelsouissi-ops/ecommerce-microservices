# Intégration n8n

Ce dossier documente l’automatisation n8n utilisée autour du parcours de commande du projet e-commerce.

## Objectif

n8n joue le rôle de couche d’orchestration métier entre le front, l’API Gateway et les services backend. Il permet de déclencher un scénario automatisé dès qu’une demande de commande est reçue, sans ajouter de logique d’intégration complexe dans les microservices.

## Workflow mis en place

Le workflow expose un webhook HTTP qui reçoit un `POST` avec les champs suivants :

```json
{
  "product_id": "p1",
  "quantity": 2,
  "customer": "lotfi",
  "email": "manelsouissii78@gmail.com"
}
```

Étapes du workflow :

1. Le webhook n8n reçoit la requête.
2. n8n appelle `POST /orders` sur l’API Gateway.
3. L’API Gateway transmet la demande au `OrderService` via gRPC.
4. `OrderService` publie l’événement Kafka `order.placed`.
5. `InventoryService` et `NotificationService` consomment l’événement.
6. n8n renvoie une réponse de confirmation au client.

Exemple de réponse :

```json
{
  "status": "success",
  "customer": "lotfi",
  "email_sent_to": "manelsouissii78@gmail.com",
  "message": "Commande confirmée et workflow automatisé exécuté avec succès."
}
```

## Installation et lancement

### Prérequis

- Node.js v18+ si vous lancez n8n localement
- Docker Desktop si vous préférez exécuter n8n en conteneur
- L’API Gateway doit être accessible sur `http://localhost:3000`

### Option 1 - lancement local

```bash
npm install -g n8n
n8n
```

### Option 2 - lancement avec Docker

```bash
docker run -it --rm -p 5678:5678 n8nio/n8n
```

### Utilisation

1. Ouvrir l’interface n8n.
2. Importer ou recréer le workflow de commande.
3. Configurer le webhook d’entrée.
4. Configurer l’appel HTTP vers l’API Gateway.
5. Tester avec une requête `POST` contenant `product_id`, `quantity`, `customer` et `email`.

## Valeur métier

Cette automatisation apporte plusieurs gains :

- accélération du traitement des commandes,
- réduction des tâches manuelles autour de la confirmation,
- meilleure réutilisation du workflow pour d’autres scénarios,
- intégration plus simple avec des outils externes,
- séparation claire entre la logique métier des microservices et la logique d’orchestration.
