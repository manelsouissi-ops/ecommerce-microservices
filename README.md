# E-Commerce Microservices

Application e-commerce basée sur une architecture microservices développée en Node.js.

**Étudiants :** Manel Souissi · Mohamed Raed Trifi
**Module :** SoA et Microservices · Dr. Salah Gontara · A.U. 2025-26

---

## Architecture

Client
│
└── API Gateway (port 3000)
├── REST  → HTTP/1.1 + JSON
└── GraphQL → HTTP/1.1 + JSON
│
└── gRPC (HTTP/2 + Protobuf)
├── OrderService        (port 50051) → SQLite3
├── InventoryService    (port 50052) → SQLite3
└── NotificationService (port 50053) → RxDB
│
└── Kafka Broker (port 9092)
├── Producteur : OrderService
└── Consommateurs : InventoryService, NotificationService

---

## Microservices

### OrderService — port 50051
Gère la création et la consultation des commandes.
- Base de données : SQLite3 (`orders.db`)
- Rôle Kafka : **Producteur** — publie sur `order.placed`

### InventoryService — port 50052
Gère le stock des produits.
- Base de données : SQLite3 (`inventory.db`)
- Rôle Kafka : **Consommateur** — écoute `order.placed` et déduit le stock

### NotificationService — port 50053
Gère les notifications clients.
- Base de données : RxDB (NoSQL, en mémoire)
- Rôle Kafka : **Consommateur** — écoute `order.placed` et crée une notification

---

## Fichiers .proto (contrats gRPC)

### order.proto
```proto
service OrderService {
  rpc CreateOrder (CreateOrderRequest) returns (OrderResponse);
  rpc GetOrder    (GetOrderRequest)    returns (OrderResponse);
  rpc ListOrders  (ListOrdersRequest)  returns (ListOrdersResponse);
}
```

### inventory.proto
```proto
service InventoryService {
  rpc GetProduct   (GetProductRequest)   returns (ProductResponse);
  rpc ListProducts (ListProductsRequest) returns (ListProductsResponse);
  rpc UpdateStock  (UpdateStockRequest)  returns (ProductResponse);
}
```

### notification.proto
```proto
service NotificationService {
  rpc SendNotification  (NotificationRequest) returns (NotificationResponse);
  rpc ListNotifications (ListNotifRequest)    returns (ListNotifResponse);
}
```

---

## Endpoints REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/products` | Lister tous les produits |
| GET | `/products/:id` | Obtenir un produit par ID |
| POST | `/orders` | Créer une commande |
| GET | `/orders` | Lister toutes les commandes |
| GET | `/orders/:id` | Obtenir une commande par ID |
| GET | `/notifications/:customer` | Lister les notifications d'un client |

### Exemple — Créer une commande
```http
POST /orders
Content-Type: application/json

{
  "product_id": "p1",
  "quantity": 2,
  "customer": "lotfi"
}
```

---

## Schéma GraphQL

```graphql
type Query {
  listOrders:                        [Order]
  getOrder(order_id: String!):       Order
  listProducts:                      [Product]
  getProduct(product_id: String!):   Product
  listNotifications(customer: String!): [Notification]
}

type Mutation {
  createOrder(product_id: String!, quantity: Int!, customer: String!): Order
  sendNotification(customer: String!, message: String!, type: String!): Notification
}
```

### Exemple — Query GraphQL
```graphql
query {
  listProducts {
    product_id
    name
    stock
    price
  }
}
```

### Exemple — Mutation GraphQL
```graphql
mutation {
  createOrder(product_id: "p1", quantity: 2, customer: "lotfi") {
    order_id
    status
  }
}
```

---

## Topics Kafka

| Topic | Producteur | Consommateurs | Contenu |
|-------|-----------|---------------|---------|
| `order.placed` | OrderService | InventoryService, NotificationService | `{ order_id, product_id, quantity, customer }` |

### Scénario métier
1. Client crée une commande via `POST /orders`
2. OrderService sauvegarde la commande et publie `order.placed`
3. InventoryService reçoit l'événement → déduit le stock
4. NotificationService reçoit l'événement → crée une notification de confirmation

---

## Bases de données

| Service | Type | Technologie | Fichier |
|---------|------|-------------|---------|
| OrderService | SQL | SQLite3 | `orders.db` |
| InventoryService | SQL | SQLite3 | `inventory.db` |
| NotificationService | NoSQL | RxDB | En mémoire |

---

## Installation et exécution

### Prérequis
- Node.js v18+
- Docker Desktop

### 1. Cloner le projet
```bash
git clone https://github.com/manelsouissi-ops/ecommerce-microservices.git
cd ecommerce-microservices
```

### 2. Installer les dépendances
```bash
cd order-service && npm install && cd ..
cd inventory-service && npm install && cd ..
cd notification-service && npm install && cd ..
cd api-gateway && npm install && cd ..
```

### 3. Lancer Kafka
```bash
docker compose up -d
```

### 4. Lancer les microservices (4 terminaux séparés)
```bash
# Terminal 1
cd order-service && node index.js

# Terminal 2
cd inventory-service && node index.js

# Terminal 3
cd notification-service && node index.js

# Terminal 4
cd api-gateway && node index.js
```

### 5. Tester
- REST : `http://localhost:3000/products`
- GraphQL : `http://localhost:3000/graphql`

---

## Stack technique

| Technologie | Rôle |
|-------------|------|
| Node.js | Runtime unique pour tous les services |
| gRPC + Protobuf | Communication synchrone Gateway ↔ Services |
| Kafka (KafkaJS) | Communication asynchrone entre services |
| Express | Serveur HTTP REST |
| apollo-server-express | Serveur GraphQL |
| better-sqlite3 | Base de données SQL |
| RxDB | Base de données NoSQL |
| Docker Compose | Orchestration Kafka + Zookeeper |