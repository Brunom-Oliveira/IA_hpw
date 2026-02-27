CREATE TABLE clients (
  id INT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  document VARCHAR(30) NOT NULL
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  client_id INT NOT NULL,
  status VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_orders_clients FOREIGN KEY (client_id) REFERENCES clients(id)
);
