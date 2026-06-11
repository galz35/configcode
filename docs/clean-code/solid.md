# Principios SOLID y Diseño de Código Limpio

Esta guía técnica define los principios SOLID aplicados al desarrollo de software moderno con ejemplos prácticos en TypeScript. Seguir estas pautas garantiza código mantenible, extensible y fácil de testear.

---

## 1. Single Responsibility Principle (SRP) - Principio de Responsabilidad Única

> "Una clase o módulo debe tener una, y solo una, razón para cambiar."

Cada componente, clase o función debe hacer una sola cosa bien. Si una clase tiene múltiples responsabilidades, los cambios en una de ellas pueden romper las otras.

### Antipatrón ❌:
Una clase que maneja la lógica de negocio del usuario, la persistencia en base de datos y el envío de notificaciones.
```typescript
class UserService {
  register(userData: any) {
    // 1. Validar y registrar
    const user = { ...userData, id: Date.now() };
    
    // 2. Guardar en base de datos
    db.insert('users', user);
    
    // 3. Enviar email de bienvenida
    const mailer = new Mailer();
    mailer.sendEmail(user.email, "Bienvenido", "Hola!");
  }
}
```

### Práctica Recomendada ✅:
Dividir las responsabilidades en clases separadas y coordinarlas.
```typescript
class UserRepository {
  save(user: User): void {
    db.insert('users', user);
  }
}

class EmailService {
  sendWelcome(email: string): void {
    const mailer = new Mailer();
    mailer.sendEmail(email, "Bienvenido", "Hola!");
  }
}

class UserService {
  constructor(
    private userRepo: UserRepository,
    private emailService: EmailService
  ) {}

  register(userData: UserInput): void {
    const user = new User(userData);
    this.userRepo.save(user);
    this.emailService.sendWelcome(user.email);
  }
}
```

---

## 2. Open/Closed Principle (OCP) - Principio de Abierto/Cerrado

> "Las entidades de software (clases, módulos, funciones) deben estar abiertas para su extensión, pero cerradas para su modificación."

Debemos poder añadir nueva funcionalidad sin alterar el código existente. Esto se logra mediante abstracciones (interfaces o clases abstractas).

### Antipatrón ❌:
Si añadimos un nuevo método de pago, tenemos que modificar la clase `PaymentProcessor` agregando un nuevo condicional `if/case`.
```typescript
class PaymentProcessor {
  processPayment(amount: number, method: string) {
    if (method === 'paypal') {
      // Lógica de PayPal
    } else if (method === 'credit_card') {
      // Lógica de tarjeta de crédito
    }
    // Si queremos agregar Stripe, tenemos que modificar este archivo.
  }
}
```

### Práctica Recomendada ✅:
Definir una interfaz común y extender mediante polimorfismo.
```typescript
interface PaymentMethod {
  process(amount: number): void;
}

class PaypalPayment implements PaymentMethod {
  process(amount: number): void {
    // Lógica de PayPal
  }
}

class StripePayment implements PaymentMethod {
  process(amount: number): void {
    // Lógica de Stripe
  }
}

class PaymentProcessor {
  processPayment(amount: number, paymentMethod: PaymentMethod) {
    paymentMethod.process(amount);
  }
}
```

---

## 3. Liskov Substitution Principle (LSP) - Principio de Sustitución de Liskov

> "Si S es un subtipo de T, entonces los objetos de tipo T pueden ser reemplazados por objetos de tipo S sin alterar las propiedades deseadas del programa."

Las subclases deben poder usarse como si fueran sus clases padre sin romper el funcionamiento de la aplicación.

### Antipatrón ❌:
La clase `Ostrich` (Avestruz) hereda de `Bird` (Ave), pero no puede volar. Al llamar al método `fly`, arroja un error inesperado.
```typescript
class Bird {
  fly(): void {
    console.log("Volando...");
  }
}

class Ostrich extends Bird {
  fly(): void {
    throw new Error("No puedo volar!"); // Rompe el principio de Liskov
  }
}
```

### Práctica Recomendada ✅:
Separar las habilidades en interfaces o subcategorías correctas.
```typescript
class Bird {}

class FlyingBird extends Bird {
  fly(): void {
    console.log("Volando...");
  }
}

class Ostrich extends Bird {
  // Solo hereda lo que realmente puede hacer
}
```

---

## 4. Interface Segregation Principle (ISP) - Principio de Segregación de Interfaces

> "Los clientes no deben ser obligados a depender de interfaces que no utilizan."

Es mejor tener muchas interfaces específicas que una sola interfaz gigante y genérica.

### Antipatrón ❌:
Una interfaz gigante que obliga a un bot a implementar métodos de interacción humana que no necesita.
```typescript
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
}

class Robot implements Worker {
  work() { /* trabaja */ }
  eat() { throw new Error("Los robots no comen"); } // Obligado a implementar
  sleep() { throw new Error("Los robots no duermen"); } // Obligado a implementar
}
```

### Práctica Recomendada ✅:
Segregar en interfaces más pequeñas y cohesivas.
```typescript
interface Workable {
  work(): void;
}

interface Feedable {
  eat(): void;
}

class Robot implements Workable {
  work() { /* trabaja */ }
}

class Human implements Workable, Feedable {
  work() { /* trabaja */ }
  eat() { /* come */ }
}
```

---

## 5. Dependency Inversion Principle (DIP) - Principio de Inversión de Dependencias

> "Los módulos de alto nivel no deben depender de módulos de bajo nivel. Ambos deben depender de abstracciones. Las abstracciones no deben depender de los detalles, los detalles deben depender de las abstracciones."

Las clases de negocio no deben instanciar directamente bases de datos, APIs o servicios. Deben recibirlos como interfaces mediante Inyección de Dependencias.

### Antipatrón ❌:
`Dashboard` depende directamente del detalle de implementación de la clase `SqlServerDatabase` (Módulo de bajo nivel).
```typescript
class SqlServerDatabase {
  connect() { /* ... */ }
  query(sql: string) { /* ... */ }
}

class Dashboard {
  private db: SqlServerDatabase;

  constructor() {
    this.db = new SqlServerDatabase(); // Acoplamiento fuerte / no se puede testear con mock
  }
}
```

### Práctica Recomendada ✅:
`Dashboard` depende de la abstracción `DatabaseConnection`.
```typescript
interface DatabaseConnection {
  connect(): void;
  query(sql: string): any;
}

class SqlServerDatabase implements DatabaseConnection {
  connect() { /* ... */ }
  query(sql: string) { /* ... */ }
}

class MongoDatabase implements DatabaseConnection {
  connect() { /* ... */ }
  query(sql: string) { /* ... */ }
}

class Dashboard {
  constructor(private db: DatabaseConnection) {} // Inyección de dependencias
}
```
