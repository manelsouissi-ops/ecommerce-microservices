# Tests de l'application

Tous les tests ont été réalisés avec Postman et le navigateur.
Les 4 services doivent être lancés avant de tester.

---

## Prérequis

Terminal 1 : cd order-service && node index.js
Terminal 2 : cd inventory-service && node index.js
Terminal 3 : cd notification-service && node index.js
Terminal 4 : cd api-gateway && node index.js

---

## Tests REST

### 1. Lister les produits
GET http://localhost:3000/products
Résultat attendu : 200 OK — liste des 3 produits (Laptop, Phone, Headset)

### 2. Obtenir un produit par ID
GET http://localhost:3000/products/p1
Résultat attendu : 200 OK — détails du Laptop

### 3. Créer une commande
POST http://localhost:3000/orders
Content-Type: application/json
{
  "product_id": "p1",
  "quantity": 2,
  "customer": "lotfi"
}
Résultat attendu : 201 Created — commande créée avec un UUID

### 4. Lister les commandes
GET http://localhost:3000/orders
Résultat attendu : 200 OK — liste de toutes les commandes

### 5. Obtenir une commande par ID
GET http://localhost:3000/orders/{order_id}
Résultat attendu : 200 OK — détails de la commande

### 6. Lister les notifications
GET http://localhost:3000/notifications/lotfi
Résultat attendu : 200 OK — notification de confirmation de commande

---

## Tests GraphQL

Endpoint : POST http://localhost:3000/graphql

### 1. Lister les produits
query {
  listProducts {
    product_id
    name
    stock
    price
  }
}
Résultat attendu : liste des produits avec stock mis à jour

### 2. Créer une commande
mutation {
  createOrder(product_id: "p2", quantity: 1, customer: "manel") {
    order_id
    product_id
    quantity
    customer
    status
  }
}
Résultat attendu : commande créée avec status "pending"

### 3. Lister les commandes
query {
  listOrders {
    order_id
    customer
    status
  }
}

### 4. Lister les notifications
query {
  listNotifications(customer: "lotfi") {
    message
    type
    status
  }
}

---

## Test Kafka

Ce test vérifie que Kafka propage correctement les événements entre services.

Étapes :
1. Créer une commande via POST /orders
2. Observer le terminal InventoryService
3. Observer le terminal NotificationService

Résultat attendu dans InventoryService :
  Événement reçu : order.placed pour produit p1
  Stock mis à jour : -2 pour p1

Résultat attendu dans NotificationService :
  Événement reçu : order.placed pour lotfi
  Notification envoyée à lotfi

---

## Résumé des tests

| Test                  | Méthode | Endpoint                    | Status        |
|-----------------------|---------|-----------------------------|---------------|
| Lister produits       | GET     | /products                   | 200 OK        |
| Obtenir produit       | GET     | /products/:id               | 200 OK        |
| Créer commande        | POST    | /orders                     | 201 Created   |
| Lister commandes      | GET     | /orders                     | 200 OK        |
| Lister notifications  | GET     | /notifications/:customer    | 200 OK        |
| GraphQL listProducts  | POST    | /graphql                    | 200 OK        |
| GraphQL createOrder   | POST    | /graphql                    | 200 OK        |
| Kafka propagation     | -       | -                           | Fonctionnel   |