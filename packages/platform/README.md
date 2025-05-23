# Introduction

Welcome to the documentation for `@effect/platform`, a library designed for creating platform-independent abstractions (Node.js, Bun, browsers).

> [!WARNING]
> This documentation focuses on **unstable modules**. For stable modules, refer to the [official website documentation](https://effect.website/docs/guides/platform/introduction).

# HTTP API

## Overview

The `HttpApi` modules offer a flexible and declarative way to define HTTP APIs. You build an API by combining endpoints, each describing its path and the request/response schemas. Once defined, the same API definition can be used to:

- Spin up a server
- Provide a Swagger documentation page
- Derive a fully-typed client

This separation helps avoid duplication, keeps everything up to date, and simplifies maintenance when your API evolves. It also makes it straightforward to add new functionality or reconfigure existing endpoints without changing the entire stack.

## Hello World

Here is a simple example of defining an API with a single endpoint that returns a string:

**Example** (Defining an API)

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

// Define our API with one group named "Greetings" and one endpoint called "hello-world"
const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("Greetings").add(
    HttpApiEndpoint.get("hello-world")`/`.addSuccess(Schema.String)
  )
)

// Implement the "Greetings" group
const GreetingsLive = HttpApiBuilder.group(MyApi, "Greetings", (handlers) =>
  handlers.handle("hello-world", () => Effect.succeed("Hello, World!"))
)

// Provide the implementation for the API
const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(GreetingsLive))

// Set up the server using NodeHttpServer on port 3000
const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(MyApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

// Run the server
Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
```

Navigate to `http://localhost:3000` in your browser to see the response "Hello, World!".

### Serving The Auto Generated Swagger Documentation

You can add Swagger documentation to your API by including the `HttpApiSwagger` module. Provide the `HttpApiSwagger.layer` in your server setup, as shown here:

**Example** (Serving Swagger Documentation)

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("Greetings").add(
    HttpApiEndpoint.get("hello-world")`/`.addSuccess(Schema.String)
  )
)

const GreetingsLive = HttpApiBuilder.group(MyApi, "Greetings", (handlers) =>
  handlers.handle("hello-world", () => Effect.succeed("Hello, World!"))
)

const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(GreetingsLive))

const ServerLive = HttpApiBuilder.serve().pipe(
  // Provide the Swagger layer so clients can access auto-generated docs
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(MyApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
```

Navigate to `http://localhost:3000/docs` in your browser to see the Swagger documentation:

![Swagger Documentation](./images/swagger-hello-world.png)

### Deriving a Client

After you define your API, you can generate a client to interact with the server. The `HttpApiClient` module provides the needed tools:

**Example** (Deriving a Client)

```ts
import {
  FetchHttpClient,
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("Greetings").add(
    HttpApiEndpoint.get("hello-world")`/`.addSuccess(Schema.String)
  )
)

const GreetingsLive = HttpApiBuilder.group(MyApi, "Greetings", (handlers) =>
  handlers.handle("hello-world", () => Effect.succeed("Hello, World!"))
)

const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(GreetingsLive))

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(MyApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)

// Create a program that derives and uses the client
const program = Effect.gen(function* () {
  // Derive the client
  const client = yield* HttpApiClient.make(MyApi, {
    baseUrl: "http://localhost:3000"
  })
  // Call the "hello-world" endpoint
  const hello = yield* client.Greetings["hello-world"]()
  console.log(hello)
})

// Provide a Fetch-based HTTP client and run the program
Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)))
// Output: Hello, World!
```

## Basic Usage

To define an API, create a set of endpoints. Each endpoint is described by a path, a method, and schemas for the request and response.

Collections of endpoints are grouped in an `HttpApiGroup`, and multiple groups can be merged into a complete API.

```
API
├── Group
│   ├── Endpoint
│   └── Endpoint
└── Group
    ├── Endpoint
    ├── Endpoint
    └── Endpoint
```

### Defining a HttpApiGroup

Below is a simple CRUD API for user management. We have an `HttpApiGroup` with the following endpoints:

- `GET /users/:userId` - Find a user by id
- `POST /users` - Create a new user
- `DELETE /users/:userId` - Delete a user by id
- `PATCH /users/:userId` - Update a user by id

**Example** (Defining a Group)

```ts
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

// Our domain "User" Schema
class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

// Our user id path parameter schema
const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

const usersApi = HttpApiGroup.make("users")
  .add(
    // Each endpoint has a name and a path.
    // You can use a template string to define path parameters...
    HttpApiEndpoint.get("findById")`/users/${UserIdParam}`
      // Add a Schema for a successful response.
      .addSuccess(User)
  )
  .add(
    // ..or you can pass the path as a string and use `.setPath` to define path parameters.
    HttpApiEndpoint.post("create", "/users")
      .addSuccess(User)
      // Define a Schema for the request body.
      // Since this is a POST, data is in the body.
      // For GET requests, data could be in the URL search parameters.
      .setPayload(
        Schema.Struct({
          name: Schema.String
        })
      )
  )
  // By default, this endpoint responds with 204 No Content.
  .add(HttpApiEndpoint.del("delete")`/users/${UserIdParam}`)
  .add(
    HttpApiEndpoint.patch("update")`/users/${UserIdParam}`
      .addSuccess(User)
      .setPayload(
        Schema.Struct({
          name: Schema.String
        })
      )
  )
```

You can also extend `HttpApiGroup` with a class to create an opaque type:

**Example** (Defining a Group with an Opaque Type)

```ts
class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`
  // ... etc
) {}
```

### Creating the Top-Level HttpApi

After defining your groups, you can combine them into a single `HttpApi` to represent the full set of endpoints for your application.

**Example** (Combining Groups into a Top-Level API)

```ts
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema
} from "@effect/platform"
import { Schema } from "effect"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

class UsersApi extends HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("findById")`/users/${UserIdParam}`.addSuccess(User))
  .add(
    HttpApiEndpoint.post("create", "/users")
      .addSuccess(User)
      .setPayload(
        Schema.Struct({
          name: Schema.String
        })
      )
  )
  .add(HttpApiEndpoint.del("delete")`/users/${UserIdParam}`)
  .add(
    HttpApiEndpoint.patch("update")`/users/${UserIdParam}`
      .addSuccess(User)
      .setPayload(
        Schema.Struct({
          name: Schema.String
        })
      )
  ) {}

// Combine the groups into a top-level API with an opaque style
class MyApi extends HttpApi.make("myApi").add(UsersApi) {}

// Alternatively, use a non-opaque style
const api = HttpApi.make("myApi").add(UsersApi)
```

### Adding errors

Error responses can be added to your endpoints to handle various scenarios. These responses can be specific to an endpoint, a group of endpoints, or the entire API.

- Use `HttpApiEndpoint.addError` to add an error response to a specific endpoint.
- Use `HttpApiGroup.addError` to add an error response to all endpoints in a group.
- Use `HttpApi.addError` to add an error response to all endpoints in the API.

Group-level and API-level errors are particularly useful for handling common error scenarios, such as authentication failures, that might be managed through middleware.

**Example** (Adding Errors to Endpoints and Groups)

```ts
// Define error schemas
class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  {}
) {}

class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {}
) {}

class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("findById")`/users/${UserIdParam}`
      .addSuccess(User)
      // Add a 404 error response for this endpoint
      .addError(UserNotFound, { status: 404 })
  )
  // Add a 401 error response to the entire group
  .addError(Unauthorized, { status: 401 }) {
  // ...etc
}
```

You can add multiple error responses to a single endpoint by calling `HttpApiEndpoint.addError` multiple times. This allows you to handle different types of errors with specific status codes and descriptions, ensuring that the API behaves as expected in various scenarios.

### Multipart Requests

To handle file uploads, you can use the `HttpApiSchema.Multipart` API to designate an endpoint's payload schema as a multipart request. This allows you to specify the structure of the expected multipart data, including file uploads, using the `Multipart` module.

**Example** (Handling File Uploads)

```ts
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  Multipart
} from "@effect/platform"
import { Schema } from "effect"

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.post("upload")`/users/upload`.setPayload(
    // Mark the payload as a multipart request
    HttpApiSchema.Multipart(
      Schema.Struct({
        // Define a "files" field for the uploaded files
        files: Multipart.FilesSchema
      })
    )
  )
) {}
```

This setup makes it clear that the endpoint expects a multipart request with a `files` field. The `Multipart.FilesSchema` automatically handles file data, making it easier to work with uploads in your application.

### Changing the response encoding

By default, responses are encoded as JSON. If you need a different format, you can modify the encoding using the `HttpApiSchema.withEncoding` API. This allows you to specify both the type and content of the response.

**Example** (Changing Response Encoding to `text/csv`)

```ts
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

// Define the UsersApi group with an endpoint that returns CSV data
class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("csv")`/users/csv`
    // Define the success response as a string and set the encoding to CSV
    .addSuccess(
      Schema.String.pipe(
        HttpApiSchema.withEncoding({
          kind: "Text",
          contentType: "text/csv"
        })
      )
    )
) {}
```

## Implementing a Server

Now that you have defined your API, you can implement a server that serves the
endpoints.

The `HttpApiBuilder` module provides all the apis you need to implement your
server.

For semplicity we will use a `UsersApi` group with a single `findById` endpoint.

```ts
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema
} from "@effect/platform"
import { Schema } from "effect"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`.addSuccess(User)
) {}

class MyApi extends HttpApi.make("myApi").add(UsersApi) {}
```

### Implementing a HttpApiGroup

The `HttpApiBuilder.group` API is used to implement a specific group of endpoints within an `HttpApi` definition. It requires the following inputs:

| Input                             | Description                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| The complete `HttpApi` definition | The overall API structure that includes the group you are implementing. |
| The name of the group             | The specific group you are focusing on within the API.                  |
| A function to add handlers        | A function that defines how each endpoint in the group is handled.      |

Each endpoint in the group is connected to its logic using the `HttpApiBuilder.handle` method, which maps the endpoint's definition to its corresponding implementation.

The `HttpApiBuilder.group` API produces a `Layer` that can later be provided to the server implementation.

**Example** (Implementing an API Group)

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema
} from "@effect/platform"
import { DateTime, Effect, Schema } from "effect"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`.addSuccess(User)
) {}

class MyApi extends HttpApi.make("myApi").add(UsersApi) {}

// --------------------------------------------
// Implementation
// --------------------------------------------

//      ┌─── Layer<HttpApiGroup.ApiGroup<"myApi", "users">>
//      ▼
const UsersApiLive =
  //                       ┌─── The Whole API
  //                       │       ┌─── The Group you are implementing
  //                       ▼       ▼
  HttpApiBuilder.group(MyApi, "users", (handlers) =>
    handlers.handle(
      //  ┌─── The Endpoint you are implementing
      //  ▼
      "findById",
      // Provide the handler logic for the endpoint.
      // The parameters & payload are passed to the handler function.
      ({ path: { userId } }) =>
        Effect.succeed(
          // Return a mock user object with the provided ID
          new User({
            id: userId,
            name: "John Doe",
            createdAt: DateTime.unsafeNow()
          })
        )
    )
  )
```

Using `HttpApiBuilder.group`, you connect the structure of your API to its logic, enabling you to focus on each endpoint's functionality in isolation. Each handler receives the parameters and payload for the request, making it easy to process input and generate a response.

### Using Services Inside a HttpApiGroup

If your handlers need to use services, you can easily integrate them because the `HttpApiBuilder.group` API allows you to return an `Effect`. This ensures that external services can be accessed and utilized directly within your handlers.

**Example** (Using Services in a Group Implementation)

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema
} from "@effect/platform"
import { Context, Effect, Schema } from "effect"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`.addSuccess(User)
) {}

class MyApi extends HttpApi.make("myApi").add(UsersApi) {}

// Define the UsersRepository service
class UsersRepository extends Context.Tag("UsersRepository")<
  UsersRepository,
  {
    readonly findById: (id: number) => Effect.Effect<User>
  }
>() {}

//      ┌─── Layer<HttpApiGroup.ApiGroup<"myApi", "users">, never, UsersRepository>
//      ▼
const UsersApiLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  Effect.gen(function* () {
    // Access the UsersRepository service
    const repository = yield* UsersRepository
    return handlers.handle("findById", ({ path: { userId } }) =>
      repository.findById(userId)
    )
  })
)
```

### Implementing a HttpApi

Once all your groups are implemented, you can create a top-level implementation to combine them into a unified API. This is done using the `HttpApiBuilder.api` API, which generates a `Layer`. You then use `Layer.provide` to include the implementations of all the groups into the top-level `HttpApi`.

**Example** (Combining Group Implementations into a Top-Level API)

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema
} from "@effect/platform"
import { DateTime, Effect, Layer, Schema } from "effect"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`.addSuccess(User)
) {}

class MyApi extends HttpApi.make("myApi").add(UsersApi) {}

// --------------------------------------------
// Implementation
// --------------------------------------------

const UsersApiLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers.handle("findById", ({ path: { userId } }) =>
    Effect.succeed(
      // Return a mock user object with the provided ID
      new User({
        id: userId,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      })
    )
  )
)

// Combine all group implementations into the top-level API
//
//      ┌─── Layer<HttpApi.Api, never, never>
//      ▼
const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(UsersApiLive))
```

### Serving the API

You can serve your API using the `HttpApiBuilder.serve` API. This function builds an `HttpApp` from an `HttpApi` instance and serves it using an `HttpServer`.

Optionally, you can provide middleware to enhance the `HttpApp` before serving it.

**Example** (Serving an API with Middleware)

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpMiddleware,
  HttpServer
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { DateTime, Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`.addSuccess(User)
) {}

class MyApi extends HttpApi.make("myApi").add(UsersApi) {}

const UsersApiLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers.handle("findById", ({ path: { userId } }) =>
    Effect.succeed(
      new User({
        id: userId,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      })
    )
  )
)

const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(UsersApiLive))

// Use the `HttpApiBuilder.serve` function to serve the API
const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // Add middleware for Cross-Origin Resource Sharing (CORS)
  Layer.provide(HttpApiBuilder.middlewareCors()),
  // Provide the API implementation
  Layer.provide(MyApiLive),
  // Log the server's listening address
  HttpServer.withLogAddress,
  // Provide the HTTP server implementation
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

// run the server
Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
```

## Middlewares

### Defining Middleware

The `HttpApiMiddleware` module allows you to add middleware to your API. Middleware can enhance your API by introducing features like logging, authentication, or additional error handling.

You can define middleware using the `HttpApiMiddleware.Tag` class, which lets you specify:

| Option     | Description                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `failure`  | A schema that describes any errors the middleware might return.                                                                                                                                                                 |
| `provides` | A `Context.Tag` representing the resource or data the middleware will provide to subsequent handlers.                                                                                                                           |
| `security` | Definitions from `HttpApiSecurity` that the middleware will implement, such as authentication mechanisms.                                                                                                                       |
| `optional` | A boolean indicating whether the request should continue if the middleware fails with an expected error. When `optional` is set to `true`, the `provides` and `failure` options do not affect the final error type or handlers. |

**Example** (Defining a Logger Middleware)

```ts
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware
} from "@effect/platform"
import { Schema } from "effect"

// Define a schema for errors returned by the logger middleware
class LoggerError extends Schema.TaggedError<LoggerError>()(
  "LoggerError",
  {}
) {}

// Extend the HttpApiMiddleware.Tag class to define the logger middleware tag
class Logger extends HttpApiMiddleware.Tag<Logger>()("Http/Logger", {
  // Optionally define the error schema for the middleware
  failure: LoggerError
}) {}

class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("findById")`/${Schema.NumberFromString}`
      // Apply the middleware to a single endpoint
      .middleware(Logger)
  )
  // Or apply the middleware to the entire group
  .middleware(Logger) {}
```

### Implementing HttpApiMiddleware

Once you have defined your `HttpApiMiddleware`, you can implement it as a `Layer`. This allows the middleware to be applied to specific API groups or endpoints, enabling modular and reusable behavior.

**Example** (Implementing and Using Logger Middleware)

```ts
import { HttpApiMiddleware, HttpServerRequest } from "@effect/platform"
import { Effect, Layer } from "effect"

class Logger extends HttpApiMiddleware.Tag<Logger>()("Http/Logger") {}

const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    yield* Effect.log("creating Logger middleware")

    // Middleware implementation as an Effect
    // that can access the `HttpServerRequest` context.
    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      yield* Effect.log(`Request: ${request.method} ${request.url}`)
    })
  })
)
```

After implementing the middleware, you can attach it to your API groups or specific endpoints using the `Layer` APIs.

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpServerRequest
} from "@effect/platform"
import { DateTime, Effect, Layer, Schema } from "effect"

class Logger extends HttpApiMiddleware.Tag<Logger>()("Http/Logger") {}

const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    yield* Effect.log("creating Logger middleware")
    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      yield* Effect.log(`Request: ${request.method} ${request.url}`)
    })
  })
)

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/${Schema.NumberFromString}`.middleware(
    Logger
  )
) {}

class MyApi extends HttpApi.make("myApi").add(UsersApi) {}

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UsersApiLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers.handle("findById", (req) =>
    Effect.succeed(
      new User({
        id: req.path[0],
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      })
    )
  )
).pipe(
  // Provide the Logger middleware to the group
  Layer.provide(LoggerLive)
)
```

### Defining security middleware

The `HttpApiSecurity` module enables you to add security annotations to your API. These annotations specify the type of authorization required to access specific endpoints.

Supported authorization types include:

| Authorization Type       | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `HttpApiSecurity.apiKey` | API key authorization via headers, query parameters, or cookies. |
| `HttpApiSecurity.basic`  | HTTP Basic authentication.                                       |
| `HttpApiSecurity.bearer` | Bearer token authentication.                                     |

These security annotations can be used alongside `HttpApiMiddleware` to create middleware that protects your API endpoints.

**Example** (Defining Security Middleware)

```ts
import {
  HttpApiGroup,
  HttpApiEndpoint,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity
} from "@effect/platform"
import { Context, Schema } from "effect"

// Define a schema for the "User"
class User extends Schema.Class<User>("User")({ id: Schema.Number }) {}

// Define a schema for the "Unauthorized" error
class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  // Specify the HTTP status code for unauthorized errors
  HttpApiSchema.annotations({ status: 401 })
) {}

// Define a Context.Tag for the authenticated user
class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

// Create the Authorization middleware
class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    // Define the error schema for unauthorized access
    failure: Unauthorized,
    // Specify the resource this middleware will provide
    provides: CurrentUser,
    // Add security definitions
    security: {
      // ┌─── Custom name for the security definition
      // ▼
      myBearer: HttpApiSecurity.bearer
      // Additional security definitions can be added here.
      // They will attempt to be resolved in the order they are defined.
    }
  }
) {}

class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("findById")`/${Schema.NumberFromString}`
      // Apply the middleware to a single endpoint
      .middleware(Authorization)
  )
  // Or apply the middleware to the entire group
  .middleware(Authorization) {}
```

### Implementing HttpApiSecurity middleware

When using `HttpApiSecurity` in your middleware, the implementation involves creating a `Layer` with security handlers tailored to your requirements. Below is an example demonstrating how to implement middleware for `HttpApiSecurity.bearer` authentication.

**Example** (Implementing Bearer Token Authentication Middleware)

```ts
import {
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity
} from "@effect/platform"
import { Context, Effect, Layer, Redacted, Schema } from "effect"

class User extends Schema.Class<User>("User")({ id: Schema.Number }) {}

class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  HttpApiSchema.annotations({ status: 401 })
) {}

class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    failure: Unauthorized,
    provides: CurrentUser,
    security: { myBearer: HttpApiSecurity.bearer }
  }
) {}

const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    yield* Effect.log("creating Authorization middleware")

    // Return the security handlers for the middleware
    return {
      // Define the handler for the Bearer token
      // The Bearer token is redacted for security
      myBearer: (bearerToken) =>
        Effect.gen(function* () {
          yield* Effect.log(
            "checking bearer token",
            Redacted.value(bearerToken)
          )
          // Return a mock User object as the CurrentUser
          return new User({ id: 1 })
        })
    }
  })
)
```

### Setting HttpApiSecurity cookies

To set a security cookie from within a handler, you can use the `HttpApiBuilder.securitySetCookie` API. This method sets a cookie with default properties, including the `HttpOnly` and `Secure` flags, ensuring the cookie is not accessible via JavaScript and is transmitted over secure connections.

**Example** (Setting a Security Cookie in a Login Handler)

```ts
// Define the security configuration for an API key stored in a cookie
const security = HttpApiSecurity.apiKey({
   // Specify that the API key is stored in a cookie
  in: "cookie"
   // Define the cookie name,
  key: "token"
})

const UsersApiLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers.handle("login", () =>
    // Set the security cookie with a redacted value
    HttpApiBuilder.securitySetCookie(security, Redacted.make("keep me secret"))
  )
)
```

## Serving Swagger documentation

You can add Swagger documentation to your API using the `HttpApiSwagger` module. This integration provides an interactive interface for developers to explore and test your API. To enable Swagger, you simply provide the `HttpApiSwagger.layer` to your server implementation.

**Example** (Adding Swagger Documentation to an API)

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpApiSwagger,
  HttpMiddleware,
  HttpServer
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { DateTime, Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`.addSuccess(User)
) {}

class MyApi extends HttpApi.make("myApi").add(UsersApi) {}

const UsersApiLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers.handle("findById", ({ path: { userId } }) =>
    Effect.succeed(
      new User({
        id: userId,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      })
    )
  )
)

const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(UsersApiLive))

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // Add the Swagger documentation layer
  Layer.provide(
    HttpApiSwagger.layer({
      // Specify the Swagger documentation path.
      // "/docs" is the default path.
      path: "/docs"
    })
  ),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(MyApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
```

![Swagger Documentation](./images/swagger-myapi.png)

### Adding OpenAPI Annotations

You can enhance your API documentation by adding OpenAPI annotations using the `OpenApi` module. These annotations allow you to include metadata such as titles, descriptions, and other details, making your API documentation more informative and easier to use.

**Example** (Adding OpenAPI Annotations to a Group)

In this example:

- A title ("Users API") and description ("API for managing users") are added to the `UsersApi` group.
- These annotations will appear in the generated OpenAPI documentation.

```ts
import { OpenApi } from "@effect/platform"

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`
    .addSuccess(User)
    // You can set one attribute at a time
    .annotate(OpenApi.Title, "Users API")
    // or multiple at once
    .annotateContext(
      OpenApi.annotations({
        title: "Users API",
        description: "API for managing users"
      })
    )
) {}
```

Annotations can also be applied to the entire API. In this example, a title ("My API") is added to the top-level `HttpApi`.

**Example** (Adding OpenAPI Annotations to the Top-Level API)

```ts
class MyApi extends HttpApi.make("myApi")
  .add(UsersApi)
  // Add a title for the top-level API
  .annotate(OpenApi.Title, "My API") {}
```

## Deriving a Client

After defining your API, you can derive a client that interacts with the server. The `HttpApiClient` module simplifies the process by providing tools to generate a client based on your API definition.

**Example** (Deriving and Using a Client)

This example demonstrates how to create a client for an API and use it to call an endpoint.

```ts
import {
  FetchHttpClient,
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpApiSwagger,
  HttpMiddleware,
  HttpServer
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { DateTime, Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

const UserIdParam = HttpApiSchema.param("userId", Schema.NumberFromString)

class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("findById")`/users/${UserIdParam}`.addSuccess(User)
) {}

class MyApi extends HttpApi.make("myApi").add(UsersApi) {}

const UsersApiLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers.handle("findById", ({ path: { userId } }) =>
    Effect.succeed(
      new User({
        id: userId,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      })
    )
  )
)

const MyApiLive = HttpApiBuilder.api(MyApi).pipe(Layer.provide(UsersApiLive))

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(MyApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)

// Create a program that derives and uses the client
const program = Effect.gen(function* () {
  // Derive the client
  const client = yield* HttpApiClient.make(MyApi, {
    baseUrl: "http://localhost:3000"
  })
  // Call the `findById` endpoint
  const user = yield* client.users.findById({ path: { userId: 1 } })
  console.log(user)
})

// Provide a Fetch-based HTTP client and run the program
Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)))
/*
Example Output:
User {
  id: 1,
  name: 'John Doe',
  createdAt: DateTime.Utc(2025-01-04T15:14:49.562Z)
}
*/
```

# HTTP Client

## Overview

The `@effect/platform/HttpClient*` modules provide a way to send HTTP requests,
handle responses, and abstract over the differences between platforms.

The `HttpClient` interface has a set of methods for sending requests:

- `.execute` - takes a [HttpClientRequest](#httpclientrequest) and returns a `HttpClientResponse`
- `.{get, del, head, options, patch, post, put}` - convenience methods for creating a request and
  executing it in one step

To access the `HttpClient`, you can use the `HttpClient.HttpClient` [tag](https://effect.website/docs/guides/context-management/services).
This will give you access to a `HttpClient` instance.

**Example: Retrieving JSON Data (GET)**

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Access HttpClient
  const client = yield* HttpClient.HttpClient

  // Create and execute a GET request
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )

  const json = yield* response.json

  console.log(json)
}).pipe(
  // Ensure request is aborted if the program is interrupted
  Effect.scoped,
  // Provide the HttpClient
  Effect.provide(FetchHttpClient.layer)
)

Effect.runPromise(program)
/*
Output:
{
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\n' +
    'suscipit recusandae consequuntur expedita et cum\n' +
    'reprehenderit molestiae ut ut quas totam\n' +
    'nostrum rerum est autem sunt rem eveniet architecto'
}
*/
```

**Example: Retrieving JSON Data with accessor apis (GET)**

The `HttpClient` module also provides a set of accessor apis that allow you to
easily send requests without first accessing the `HttpClient` service.

Below is an example of using the `get` accessor api to send a GET request:

(The following examples will continue to use the `HttpClient` service approach).

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect } from "effect"

const program = HttpClient.get(
  "https://jsonplaceholder.typicode.com/posts/1"
).pipe(
  Effect.andThen((response) => response.json),
  Effect.scoped,
  Effect.provide(FetchHttpClient.layer)
)

Effect.runPromise(program)
/*
Output:
{
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\n' +
    'suscipit recusandae consequuntur expedita et cum\n' +
    'reprehenderit molestiae ut ut quas totam\n' +
    'nostrum rerum est autem sunt rem eveniet architecto'
}
*/
```

**Example: Creating and Executing a Custom Request**

Using [HttpClientRequest](#httpclientrequest), you can create and then execute a request. This is useful for customizing the request further.

```ts
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest
} from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Access HttpClient
  const client = yield* HttpClient.HttpClient

  // Create a GET request
  const req = HttpClientRequest.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )

  // Optionally customize the request

  // Execute the request and get the response
  const response = yield* client.execute(req)

  const json = yield* response.json

  console.log(json)
}).pipe(
  // Ensure request is aborted if the program is interrupted
  Effect.scoped,
  // Provide the HttpClient
  Effect.provide(FetchHttpClient.layer)
)

Effect.runPromise(program)
/*
Output:
{
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\n' +
    'suscipit recusandae consequuntur expedita et cum\n' +
    'reprehenderit molestiae ut ut quas totam\n' +
    'nostrum rerum est autem sunt rem eveniet architecto'
}
*/
```

## Understanding Scope

When working with a request, note that there is a `Scope` requirement:

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect } from "effect"

// const program: Effect<void, HttpClientError, Scope>
const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )
  const json = yield* response.json
  console.log(json)
}).pipe(
  // Provide the HttpClient implementation without scoping
  Effect.provide(FetchHttpClient.layer)
)
```

A `Scope` is required because there is an open connection between the HTTP response and the body processing. For instance, if you have a streaming body, you receive the response before processing the body. This connection is managed within a scope, and using `Effect.scoped` controls when it is closed.

## Customize a HttpClient

The `HttpClient` module allows you to customize the client in various ways. For instance, you can log details of a request before execution using the `tapRequest` function.

**Example: Tapping**

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Console, Effect } from "effect"

const program = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(
    // Log the request before fetching
    HttpClient.tapRequest(Console.log)
  )

  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )

  const json = yield* response.json

  console.log(json)
}).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))

Effect.runPromise(program)
/*
Output:
{
  _id: '@effect/platform/HttpClientRequest',
  method: 'GET',
  url: 'https://jsonplaceholder.typicode.com/posts/1',
  urlParams: [],
  hash: { _id: 'Option', _tag: 'None' },
  headers: Object <[Object: null prototype]> {},
  body: { _id: '@effect/platform/HttpBody', _tag: 'Empty' }
}
{
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\n' +
    'suscipit recusandae consequuntur expedita et cum\n' +
    'reprehenderit molestiae ut ut quas totam\n' +
    'nostrum rerum est autem sunt rem eveniet architecto'
}
*/
```

**Operations Summary**

| Operation                | Description                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `get`,`post`,`put`...    | Send a request without first accessing the `HttpClient` service.                        |
| `filterOrElse`           | Filters the result of a response, or runs an alternative effect if the predicate fails. |
| `filterOrFail`           | Filters the result of a response, or throws an error if the predicate fails.            |
| `filterStatus`           | Filters responses by HTTP status code.                                                  |
| `filterStatusOk`         | Filters responses that return a 2xx status code.                                        |
| `followRedirects`        | Follows HTTP redirects up to a specified number of times.                               |
| `mapRequest`             | Appends a transformation of the request object before sending it.                       |
| `mapRequestEffect`       | Appends an effectful transformation of the request object before sending it.            |
| `mapRequestInput`        | Prepends a transformation of the request object before sending it.                      |
| `mapRequestInputEffect`  | Prepends an effectful transformation of the request object before sending it.           |
| `retry`                  | Retries the request based on a provided schedule or policy.                             |
| `tap`                    | Performs an additional effect after a successful request.                               |
| `tapRequest`             | Performs an additional effect on the request before sending it.                         |
| `withCookiesRef`         | Associates a `Ref` of cookies with the client for handling cookies across requests.     |
| `withTracerDisabledWhen` | Disables tracing for specific requests based on a provided predicate.                   |
| `withTracerPropagation`  | Enables or disables tracing propagation for the request.                                |

### Mapping Requests

Note that `mapRequest` and `mapRequestEffect` add transformations at the end of the request chain, while `mapRequestInput` and `mapRequestInputEffect` apply transformations at the start:

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(
    // Append transformation
    HttpClient.mapRequest((req) => {
      console.log(1)
      return req
    }),
    // Another append transformation
    HttpClient.mapRequest((req) => {
      console.log(2)
      return req
    }),
    // Prepend transformation, this executes first
    HttpClient.mapRequestInput((req) => {
      console.log(3)
      return req
    })
  )

  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )

  const json = yield* response.json

  console.log(json)
}).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))

Effect.runPromise(program)
/*
Output:
3
1
2
{
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\n' +
    'suscipit recusandae consequuntur expedita et cum\n' +
    'reprehenderit molestiae ut ut quas totam\n' +
    'nostrum rerum est autem sunt rem eveniet architecto'
}
*/
```

### Persisting Cookies

You can manage cookies across requests using the `HttpClient.withCookiesRef` function, which associates a reference to a `Cookies` object with the client.

```ts
import { Cookies, FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect, Ref } from "effect"

const program = Effect.gen(function* () {
  // Create a reference to store cookies
  const ref = yield* Ref.make(Cookies.empty)

  // Access the HttpClient and associate the cookies reference with it
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.withCookiesRef(ref)
  )

  // Make a GET request to the specified URL
  yield* client.get("https://www.google.com/")

  // Log the keys of the cookies stored in the reference
  console.log(Object.keys((yield* ref).cookies))
}).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))

Effect.runPromise(program)
// Output: [ 'SOCS', 'AEC', '__Secure-ENID' ]
```

## RequestInit Options

You can customize the `FetchHttpClient` by passing `RequestInit` options to configure aspects of the HTTP requests, such as credentials, headers, and more.

In this example, we customize the `FetchHttpClient` to include credentials with every request:

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect, Layer } from "effect"

const CustomFetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include"
    })
  )
)

const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )
  const json = yield* response.json
  console.log(json)
}).pipe(Effect.scoped, Effect.provide(CustomFetchLive))
```

## Create a Custom HttpClient

You can create a custom `HttpClient` using the `HttpClient.make` function. This allows you to simulate or mock server responses within your application.

```ts
import { HttpClient, HttpClientResponse } from "@effect/platform"
import { Effect, Layer } from "effect"

const myClient = HttpClient.make((req) =>
  Effect.succeed(
    HttpClientResponse.fromWeb(
      req,
      // Simulate a response from a server
      new Response(
        JSON.stringify({
          userId: 1,
          id: 1,
          title: "title...",
          body: "body..."
        })
      )
    )
  )
)

const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )
  const json = yield* response.json
  console.log(json)
}).pipe(
  Effect.scoped,
  // Provide the HttpClient
  Effect.provide(Layer.succeed(HttpClient.HttpClient, myClient))
)

Effect.runPromise(program)
/*
Output:
{ userId: 1, id: 1, title: 'title...', body: 'body...' }
*/
```

## HttpClientRequest

### Overview

You can create a `HttpClientRequest` using the following provided constructors:

| Constructor                 | Description               |
| --------------------------- | ------------------------- |
| `HttpClientRequest.del`     | Create a DELETE request   |
| `HttpClientRequest.get`     | Create a GET request      |
| `HttpClientRequest.head`    | Create a HEAD request     |
| `HttpClientRequest.options` | Create an OPTIONS request |
| `HttpClientRequest.patch`   | Create a PATCH request    |
| `HttpClientRequest.post`    | Create a POST request     |
| `HttpClientRequest.put`     | Create a PUT request      |

### Setting Headers

When making HTTP requests, sometimes you need to include additional information in the request headers. You can set headers using the `setHeader` function for a single header or `setHeaders` for multiple headers simultaneously.

```ts
import { HttpClientRequest } from "@effect/platform"

const req = HttpClientRequest.get("https://api.example.com/data").pipe(
  // Setting a single header
  HttpClientRequest.setHeader("Authorization", "Bearer your_token_here"),
  // Setting multiple headers
  HttpClientRequest.setHeaders({
    "Content-Type": "application/json; charset=UTF-8",
    "Custom-Header": "CustomValue"
  })
)

console.log(JSON.stringify(req.headers, null, 2))
/*
Output:
{
  "authorization": "Bearer your_token_here",
  "content-type": "application/json; charset=UTF-8",
  "custom-header": "CustomValue"
}
*/
```

### basicAuth

To include basic authentication in your HTTP request, you can use the `basicAuth` method provided by `HttpClientRequest`.

```ts
import { HttpClientRequest } from "@effect/platform"

const req = HttpClientRequest.get("https://api.example.com/data").pipe(
  HttpClientRequest.basicAuth("your_username", "your_password")
)

console.log(JSON.stringify(req.headers, null, 2))
/*
Output:
{
  "authorization": "Basic eW91cl91c2VybmFtZTp5b3VyX3Bhc3N3b3Jk"
}
*/
```

### bearerToken

To include a Bearer token in your HTTP request, use the `bearerToken` method provided by `HttpClientRequest`.

```ts
import { HttpClientRequest } from "@effect/platform"

const req = HttpClientRequest.get("https://api.example.com/data").pipe(
  HttpClientRequest.bearerToken("your_token")
)

console.log(JSON.stringify(req.headers, null, 2))
/*
Output:
{
  "authorization": "Bearer your_token"
}
*/
```

### accept

To specify the media types that are acceptable for the response, use the `accept` method provided by `HttpClientRequest`.

```ts
import { HttpClientRequest } from "@effect/platform"

const req = HttpClientRequest.get("https://api.example.com/data").pipe(
  HttpClientRequest.accept("application/xml")
)

console.log(JSON.stringify(req.headers, null, 2))
/*
Output:
{
  "accept": "application/xml"
}
*/
```

### acceptJson

To indicate that the client accepts JSON responses, use the `acceptJson` method provided by `HttpClientRequest`.

```ts
import { HttpClientRequest } from "@effect/platform"

const req = HttpClientRequest.get("https://api.example.com/data").pipe(
  HttpClientRequest.acceptJson
)

console.log(JSON.stringify(req.headers, null, 2))
/*
Output:
{
  "accept": "application/json"
}
*/
```

## GET

### Converting the Response

The `HttpClientResponse` provides several methods to convert a response into different formats.

**Example: Converting to JSON**

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const getPostAsJson = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )
  return yield* response.json
}).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))

getPostAsJson.pipe(
  Effect.andThen((post) => Console.log(typeof post, post)),
  NodeRuntime.runMain
)
/*
Output:
object {
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\n' +
    'suscipit recusandae consequuntur expedita et cum\n' +
    'reprehenderit molestiae ut ut quas totam\n' +
    'nostrum rerum est autem sunt rem eveniet architecto'
}
*/
```

**Example: Converting to Text**

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const getPostAsText = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )
  return yield* response.text
}).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))

getPostAsText.pipe(
  Effect.andThen((post) => Console.log(typeof post, post)),
  NodeRuntime.runMain
)
/*
Output:
string {
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\n' +
    'suscipit recusandae consequuntur expedita et cum\n' +
    'reprehenderit molestiae ut ut quas totam\n' +
    'nostrum rerum est autem sunt rem eveniet architecto'
}
*/
```

**Methods Summary**

| Method          | Description                           |
| --------------- | ------------------------------------- |
| `arrayBuffer`   | Convert to `ArrayBuffer`              |
| `formData`      | Convert to `FormData`                 |
| `json`          | Convert to JSON                       |
| `stream`        | Convert to a `Stream` of `Uint8Array` |
| `text`          | Convert to text                       |
| `urlParamsBody` | Convert to `UrlParams`                |

### Decoding Data with Schemas

A common use case when fetching data is to validate the received format. For this purpose, the `HttpClientResponse` module is integrated with `effect/Schema`.

```ts
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse
} from "@effect/platform"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect, Schema } from "effect"

const Post = Schema.Struct({
  id: Schema.Number,
  title: Schema.String
})

const getPostAndValidate = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/posts/1"
  )
  return yield* HttpClientResponse.schemaBodyJson(Post)(response)
}).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))

getPostAndValidate.pipe(Effect.andThen(Console.log), NodeRuntime.runMain)
/*
Output:
{
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit'
}
*/
```

In this example, we define a schema for a post object with properties `id` and `title`. Then, we fetch the data and validate it against this schema using `HttpClientResponse.schemaBodyJson`. Finally, we log the validated post object.

Note that we use `Effect.scoped` after consuming the response. This ensures that any resources associated with the HTTP request are properly cleaned up once we're done processing the response.

### Filtering And Error Handling

It's important to note that `HttpClient.get` doesn't consider non-`200` status codes as errors by default. This design choice allows for flexibility in handling different response scenarios. For instance, you might have a schema union where the status code serves as the discriminator, enabling you to define a schema that encompasses all possible response cases.

You can use `HttpClient.filterStatusOk` to ensure only `2xx` responses are treated as successes.

In this example, we attempt to fetch a non-existent page and don't receive any error:

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const getText = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/non-existing-page"
  )
  return yield* response.text
}).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))

getText.pipe(Effect.andThen(Console.log), NodeRuntime.runMain)
/*
Output:
{}
*/
```

However, if we use `HttpClient.filterStatusOk`, an error is logged:

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const getText = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  const response = yield* client.get(
    "https://jsonplaceholder.typicode.com/non-existing-page"
  )
  return yield* response.text
}).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))

getText.pipe(Effect.andThen(Console.log), NodeRuntime.runMain)
/*
Output:
[17:37:59.923] ERROR (#0):
  ResponseError: StatusCode: non 2xx status code (404 GET https://jsonplaceholder.typicode.com/non-existing-page)
      ... stack trace ...
*/
```

## POST

To make a POST request, you can use the `HttpClientRequest.post` function provided by the `HttpClientRequest` module. Here's an example of how to create and send a POST request:

```ts
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest
} from "@effect/platform"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const addPost = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  return yield* HttpClientRequest.post(
    "https://jsonplaceholder.typicode.com/posts"
  ).pipe(
    HttpClientRequest.bodyJson({
      title: "foo",
      body: "bar",
      userId: 1
    }),
    Effect.flatMap(client.execute),
    Effect.flatMap((res) => res.json),
    Effect.scoped
  )
}).pipe(Effect.provide(FetchHttpClient.layer))

addPost.pipe(Effect.andThen(Console.log), NodeRuntime.runMain)
/*
Output:
{ title: 'foo', body: 'bar', userId: 1, id: 101 }
*/
```

If you need to send data in a format other than JSON, such as plain text, you can use different APIs provided by `HttpClientRequest`.

In the following example, we send the data as text:

```ts
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest
} from "@effect/platform"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const addPost = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  return yield* HttpClientRequest.post(
    "https://jsonplaceholder.typicode.com/posts"
  ).pipe(
    HttpClientRequest.bodyText(
      JSON.stringify({
        title: "foo",
        body: "bar",
        userId: 1
      }),
      "application/json; charset=UTF-8"
    ),
    client.execute,
    Effect.flatMap((res) => res.json),
    Effect.scoped
  )
}).pipe(Effect.provide(FetchHttpClient.layer))

addPost.pipe(Effect.andThen(Console.log), NodeRuntime.runMain)
/*
Output:
{ title: 'foo', body: 'bar', userId: 1, id: 101 }
*/
```

### Decoding Data with Schemas

A common use case when fetching data is to validate the received format. For this purpose, the `HttpClientResponse` module is integrated with `effect/Schema`.

```ts
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse
} from "@effect/platform"
import { NodeRuntime } from "@effect/platform-node"
import { Console, Effect, Schema } from "effect"

const Post = Schema.Struct({
  id: Schema.Number,
  title: Schema.String
})

const addPost = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  return yield* HttpClientRequest.post(
    "https://jsonplaceholder.typicode.com/posts"
  ).pipe(
    HttpClientRequest.bodyText(
      JSON.stringify({
        title: "foo",
        body: "bar",
        userId: 1
      }),
      "application/json; charset=UTF-8"
    ),
    client.execute,
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Post)),
    Effect.scoped
  )
}).pipe(Effect.provide(FetchHttpClient.layer))

addPost.pipe(Effect.andThen(Console.log), NodeRuntime.runMain)
/*
Output:
{ id: 101, title: 'foo' }
*/
```

## Testing

### Injecting Fetch

To test HTTP requests, you can inject a mock fetch implementation.

```ts
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect, Layer } from "effect"
import * as assert from "node:assert"

// Mock fetch implementation
const FetchTest = Layer.succeed(FetchHttpClient.Fetch, () =>
  Promise.resolve(new Response("not found", { status: 404 }))
)

const TestLayer = FetchHttpClient.layer.pipe(Layer.provide(FetchTest))

const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient

  return yield* client.get("https://www.google.com/").pipe(
    Effect.flatMap((res) => res.text),
    Effect.scoped
  )
})

// Test
Effect.gen(function* () {
  const response = yield* program
  assert.equal(response, "not found")
}).pipe(Effect.provide(TestLayer), Effect.runPromise)
```

# HTTP Server

## Overview

This section provides a simplified explanation of key concepts within the `@effect/platform` TypeScript library, focusing on components used to build HTTP servers. Understanding these terms and their relationships helps in structuring and managing server applications effectively.

### Core Concepts

- **HttpApp**: This is an `Effect` which results in a value `A`. It can utilize `ServerRequest` to produce the outcome `A`. Essentially, an `HttpApp` represents an application component that handles HTTP requests and generates responses based on those requests.

- **Default** (HttpApp): A special type of `HttpApp` that specifically produces a `ServerResponse` as its output `A`. This is the most common form of application where each interaction is expected to result in an HTTP response.

- **Server**: A construct that takes a `Default` app and converts it into an `Effect`. This serves as the execution layer where the `Default` app is operated, handling incoming requests and serving responses.

- **Router**: A type of `Default` app where the possible error outcome is `RouteNotFound`. Routers are used to direct incoming requests to appropriate handlers based on the request path and method.

- **Handler**: Another form of `Default` app, which has access to both `RouteContext` and `ServerRequest.ParsedSearchParams`. Handlers are specific functions designed to process requests and generate responses.

- **Middleware**: Functions that transform a `Default` app into another `Default` app. Middleware can be used to modify requests, responses, or handle tasks like logging, authentication, and more. Middleware can be applied in two ways:
  - On a `Router` using `router.use: Handler -> Default` which applies the middleware to specific routes.
  - On a `Server` using `server.serve: () -> Layer | Middleware -> Layer` which applies the middleware globally to all routes handled by the server.

### Applying Concepts

These components are designed to work together in a modular and flexible way, allowing developers to build complex server applications with reusable components. Here's how you might typically use these components in a project:

1. **Create Handlers**: Define functions that process specific types of requests (e.g., GET, POST) and return responses.

2. **Set Up Routers**: Organize handlers into routers, where each router manages a subset of application routes.

3. **Apply Middleware**: Enhance routers or entire servers with middleware to add extra functionality like error handling or request logging.

4. **Initialize the Server**: Wrap the main router with server functionality, applying any server-wide middleware, and start listening for requests.

## Getting Started

### Hello world example

In this example, we will create a simple HTTP server that listens on port `3000`. The server will respond with "Hello World!" when a request is made to the root URL (/) and return a `500` error for all other paths.

Node.js Example

```ts
import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { createServer } from "node:http"

// Define the router with a single route for the root URL
const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello World"))
)

// Set up the application server with logging
const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress)

// Specify the port
const port = 3000

// Create a server layer with the specified port
const ServerLive = NodeHttpServer.layer(() => createServer(), { port })

// Run the application
NodeRuntime.runMain(Layer.launch(Layer.provide(app, ServerLive)))

/*
Output:
timestamp=... level=INFO fiber=#0 message="Listening on http://localhost:3000"
*/
```

> [!NOTE]
> The `HttpServer.withLogAddress` middleware logs the address and port where the server is listening, helping to confirm that the server is running correctly and accessible on the expected endpoint.

Bun Example

```ts
import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"

// Define the router with a single route for the root URL
const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello World"))
)

// Set up the application server with logging
const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress)

// Specify the port
const port = 3000

// Create a server layer with the specified port
const ServerLive = BunHttpServer.layer({ port })

// Run the application
BunRuntime.runMain(Layer.launch(Layer.provide(app, ServerLive)))

/*
Output:
timestamp=... level=INFO fiber=#0 message="Listening on http://localhost:3000"
*/
```

To avoid boilerplate code for the final server setup, we'll use a helper function from the `listen.ts` file:

```ts
import type { HttpPlatform, HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { createServer } from "node:http"

export const listen = (
  app: Layer.Layer<
    never,
    never,
    HttpPlatform.HttpPlatform | HttpServer.HttpServer
  >,
  port: number
) =>
  NodeRuntime.runMain(
    Layer.launch(
      Layer.provide(
        app,
        NodeHttpServer.layer(() => createServer(), { port })
      )
    )
  )
```

### Basic routing

Routing refers to determining how an application responds to a client request to a particular endpoint, which is a URI (or path) and a specific HTTP request method (GET, POST, and so on).

Route definition takes the following structure:

```
router.pipe(HttpRouter.METHOD(PATH, HANDLER))
```

Where:

- **router** is an instance of `Router` (`import type { Router } from "@effect/platform/Http/Router"`).
- **METHOD** is an HTTP request method, in lowercase (e.g., get, post, put, del).
- **PATH** is the path on the server (e.g., "/", "/user").
- **HANDLER** is the action that gets executed when the route is matched.

The following examples illustrate defining simple routes.

Respond with `"Hello World!"` on the homepage:

```ts
router.pipe(HttpRouter.get("/", HttpServerResponse.text("Hello World")))
```

Respond to POST request on the root route (/), the application's home page:

```ts
router.pipe(HttpRouter.post("/", HttpServerResponse.text("Got a POST request")))
```

Respond to a PUT request to the `/user` route:

```ts
router.pipe(
  HttpRouter.put("/user", HttpServerResponse.text("Got a PUT request at /user"))
)
```

Respond to a DELETE request to the `/user` route:

```ts
router.pipe(
  HttpRouter.del(
    "/user",
    HttpServerResponse.text("Got a DELETE request at /user")
  )
)
```

### Serving static files

To serve static files such as images, CSS files, and JavaScript files, use the `HttpServerResponse.file` built-in action.

```ts
import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { listen } from "./listen.js"

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.file("index.html"))
)

const app = router.pipe(HttpServer.serve())

listen(app, 3000)
```

Create an `index.html` file in your project directory:

```html filename="index.html"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>index.html</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    index.html
  </body>
</html>
```

## Routing

Routing refers to how an application's endpoints (URIs) respond to client requests.

You define routing using methods of the `HttpRouter` object that correspond to HTTP methods; for example, `HttpRouter.get()` to handle GET requests and `HttpRouter.post` to handle POST requests. You can also use `HttpRouter.all()` to handle all HTTP methods.

These routing methods specify a `Route.Handler` called when the application receives a request to the specified route (endpoint) and HTTP method. In other words, the application “listens” for requests that match the specified route(s) and method(s), and when it detects a match, it calls the specified handler.

The following code is an example of a very basic route.

```ts
// respond with "hello world" when a GET request is made to the homepage
HttpRouter.get("/", HttpServerResponse.text("Hello World"))
```

### Route methods

A route method is derived from one of the HTTP methods, and is attached to an instance of the `HttpRouter` object.

The following code is an example of routes that are defined for the GET and the POST methods to the root of the app.

```ts
// GET method route
HttpRouter.get("/", HttpServerResponse.text("GET request to the homepage"))

// POST method route
HttpRouter.post("/", HttpServerResponse.text("POST request to the homepage"))
```

`HttpRouter` supports methods that correspond to all HTTP request methods: `get`, `post`, and so on.

There is a special routing method, `HttpRouter.all()`, used to load middleware functions at a path for **all** HTTP request methods. For example, the following handler is executed for requests to the route “/secret” whether using GET, POST, PUT, DELETE.

```ts
HttpRouter.all(
  "/secret",
  HttpServerResponse.empty().pipe(
    Effect.tap(Console.log("Accessing the secret section ..."))
  )
)
```

### Route paths

Route paths, when combined with a request method, define the endpoints where requests can be made. Route paths can be specified as strings according to the following type:

```ts
type PathInput = `/${string}` | "*"
```

> [!NOTE]
> Query strings are not part of the route path.

Here are some examples of route paths based on strings.

This route path will match requests to the root route, /.

```ts
HttpRouter.get("/", HttpServerResponse.text("root"))
```

This route path will match requests to `/user`.

```ts
HttpRouter.get("/user", HttpServerResponse.text("user"))
```

This route path matches requests to any path starting with `/user` (e.g., `/user`, `/users`, etc.)

```ts
HttpRouter.get(
  "/user*",
  Effect.map(HttpServerRequest.HttpServerRequest, (req) =>
    HttpServerResponse.text(req.url)
  )
)
```

### Route parameters

Route parameters are named URL segments that are used to capture the values specified at their position in the URL. By using a schema the captured values are populated in an object, with the name of the route parameter specified in the path as their respective keys.

Route parameters are named segments in a URL that capture the values specified at those positions. These captured values are stored in an object, with the parameter names used as keys.

For example:

```
Route path: /users/:userId/books/:bookId
Request URL: http://localhost:3000/users/34/books/8989
params: { "userId": "34", "bookId": "8989" }
```

To define routes with parameters, include the parameter names in the path and use a schema to validate and parse these parameters, as shown below.

```ts
import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { Effect, Schema } from "effect"
import { listen } from "./listen.js"

// Define the schema for route parameters
const Params = Schema.Struct({
  userId: Schema.String,
  bookId: Schema.String
})

// Create a router with a route that captures parameters
const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/users/:userId/books/:bookId",
    HttpRouter.schemaPathParams(Params).pipe(
      Effect.flatMap((params) => HttpServerResponse.json(params))
    )
  )
)

const app = router.pipe(HttpServer.serve())

listen(app, 3000)
```

### Response methods

The methods on `HttpServerResponse` object in the following table can send a response to the client, and terminate the request-response cycle. If none of these methods are called from a route handler, the client request will be left hanging.

| Method       | Description                    |
| ------------ | ------------------------------ |
| **empty**    | Sends an empty response.       |
| **formData** | Sends form data.               |
| **html**     | Sends an HTML response.        |
| **raw**      | Sends a raw response.          |
| **setBody**  | Sets the body of the response. |
| **stream**   | Sends a streaming response.    |
| **text**     | Sends a plain text response.   |

### Router

Use the `HttpRouter` object to create modular, mountable route handlers. A `Router` instance is a complete middleware and routing system, often referred to as a "mini-app."

The following example shows how to create a router as a module, define some routes, and mount the router module on a path in the main app.

Create a file named `birds.ts` in your app directory with the following content:

```ts
import { HttpRouter, HttpServerResponse } from "@effect/platform"

export const birds = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Birds home page")),
  HttpRouter.get("/about", HttpServerResponse.text("About birds"))
)
```

In your main application file, load the router module and mount it.

```ts
import { HttpRouter, HttpServer } from "@effect/platform"
import { birds } from "./birds.js"
import { listen } from "./listen.js"

// Create the main router and mount the birds router
const router = HttpRouter.empty.pipe(HttpRouter.mount("/birds", birds))

const app = router.pipe(HttpServer.serve())

listen(app, 3000)
```

When you run this code, your application will be able to handle requests to `/birds` and `/birds/about`, serving the respective responses defined in the `birds` router module.

## Writing Middleware

In this section, we'll build a simple "Hello World" application and demonstrate how to add three middleware functions: `myLogger` for logging, `requestTime` for displaying request timestamps, and `validateCookies` for validating incoming cookies.

### Example Application

Here is an example of a basic "Hello World" application with middleware.

### Middleware `myLogger`

This middleware logs "LOGGED" whenever a request passes through it.

```ts
const myLogger = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    console.log("LOGGED")
    return yield* app
  })
)
```

To use the middleware, add it to the router using `HttpRouter.use()`:

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { Effect } from "effect"
import { listen } from "./listen.js"

const myLogger = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    console.log("LOGGED")
    return yield* app
  })
)

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello World"))
)

const app = router.pipe(HttpRouter.use(myLogger), HttpServer.serve())

listen(app, 3000)
```

With this setup, every request to the app will log "LOGGED" to the terminal. Middleware execute in the order they are loaded.

### Middleware `requestTime`

Next, we'll create a middleware that records the timestamp of each HTTP request and provides it via a service called `RequestTime`.

```ts
class RequestTime extends Context.Tag("RequestTime")<RequestTime, number>() {}

const requestTime = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    return yield* app.pipe(Effect.provideService(RequestTime, Date.now()))
  })
)
```

Update the app to use this middleware and display the timestamp in the response:

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { Context, Effect } from "effect"
import { listen } from "./listen.js"

class RequestTime extends Context.Tag("RequestTime")<RequestTime, number>() {}

const requestTime = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    return yield* app.pipe(Effect.provideService(RequestTime, Date.now()))
  })
)

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.gen(function* () {
      const requestTime = yield* RequestTime
      const responseText = `Hello World<br/><small>Requested at: ${requestTime}</small>`
      return yield* HttpServerResponse.html(responseText)
    })
  )
)

const app = router.pipe(HttpRouter.use(requestTime), HttpServer.serve())

listen(app, 3000)
```

Now, when you make a request to the root path, the response will include the timestamp of the request.

### Middleware `validateCookies`

Finally, we'll create a middleware that validates incoming cookies. If the cookies are invalid, it sends a 400 response.

Here's an example that validates cookies using an external service:

```ts
class CookieError {
  readonly _tag = "CookieError"
}

const externallyValidateCookie = (testCookie: string | undefined) =>
  testCookie && testCookie.length > 0
    ? Effect.succeed(testCookie)
    : Effect.fail(new CookieError())

const cookieValidator = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    yield* externallyValidateCookie(req.cookies.testCookie)
    return yield* app
  }).pipe(
    Effect.catchTag("CookieError", () =>
      HttpServerResponse.text("Invalid cookie")
    )
  )
)
```

Update the app to use the `cookieValidator` middleware:

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse
} from "@effect/platform"
import { Effect } from "effect"
import { listen } from "./listen.js"

class CookieError {
  readonly _tag = "CookieError"
}

const externallyValidateCookie = (testCookie: string | undefined) =>
  testCookie && testCookie.length > 0
    ? Effect.succeed(testCookie)
    : Effect.fail(new CookieError())

const cookieValidator = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    yield* externallyValidateCookie(req.cookies.testCookie)
    return yield* app
  }).pipe(
    Effect.catchTag("CookieError", () =>
      HttpServerResponse.text("Invalid cookie")
    )
  )
)

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello World"))
)

const app = router.pipe(HttpRouter.use(cookieValidator), HttpServer.serve())

listen(app, 3000)
```

Test the middleware with the following commands:

```sh
curl -i http://localhost:3000
curl -i http://localhost:3000 --cookie "testCookie=myvalue"
curl -i http://localhost:3000 --cookie "testCookie="
```

This setup validates the `testCookie` and returns "Invalid cookie" if the validation fails, or "Hello World" if it passes.

## Applying Middleware in Your Application

Middleware functions are powerful tools that allow you to modify the request-response cycle. Middlewares can be applied at various levels to achieve different scopes of influence:

- **Route Level**: Apply middleware to individual routes.
- **Router Level**: Apply middleware to a group of routes within a single router.
- **Server Level**: Apply middleware across all routes managed by a server.

### Applying Middleware at the Route Level

At the route level, middlewares are applied to specific endpoints, allowing for targeted modifications or enhancements such as logging, authentication, or parameter validation for a particular route.

**Example**

Here's a practical example showing how to apply middleware at the route level:

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { Effect } from "effect"
import { listen } from "./listen.js"

// Middleware constructor that logs the name of the middleware
const withMiddleware = (name: string) =>
  HttpMiddleware.make((app) =>
    Effect.gen(function* () {
      console.log(name) // Log the middleware name when the route is accessed
      return yield* app // Continue with the original application flow
    })
  )

const router = HttpRouter.empty.pipe(
  // Applying middleware to route "/a"
  HttpRouter.get("/a", HttpServerResponse.text("a").pipe(withMiddleware("M1"))),
  // Applying middleware to route "/b"
  HttpRouter.get("/b", HttpServerResponse.text("b").pipe(withMiddleware("M2")))
)

const app = router.pipe(HttpServer.serve())

listen(app, 3000)
```

**Testing the Middleware**

You can test the middleware by making requests to the respective routes and observing the console output:

```sh
# Test route /a
curl -i http://localhost:3000/a
# Expected console output: M1

# Test route /b
curl -i http://localhost:3000/b
# Expected console output: M2
```

### Applying Middleware at the Router Level

Applying middleware at the router level is an efficient way to manage common functionalities across multiple routes within your application. Middleware can handle tasks such as logging, authentication, and response modifications before reaching the actual route handlers.

**Example**

Here's how you can structure and apply middleware across different routers using the `@effect/platform` library:

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { Effect } from "effect"
import { listen } from "./listen.js"

// Middleware constructor that logs the name of the middleware
const withMiddleware = (name: string) =>
  HttpMiddleware.make((app) =>
    Effect.gen(function* () {
      console.log(name) // Log the middleware name when a route is accessed
      return yield* app // Continue with the original application flow
    })
  )

// Define Router1 with specific routes
const router1 = HttpRouter.empty.pipe(
  HttpRouter.get("/a", HttpServerResponse.text("a")), // Middleware M4, M3, M1 will apply
  HttpRouter.get("/b", HttpServerResponse.text("b")), // Middleware M4, M3, M1 will apply
  // Apply Middleware at the router level
  HttpRouter.use(withMiddleware("M1")),
  HttpRouter.get("/c", HttpServerResponse.text("c")) // Middleware M4, M3 will apply
)

// Define Router2 with specific routes
const router2 = HttpRouter.empty.pipe(
  HttpRouter.get("/d", HttpServerResponse.text("d")), // Middleware M4, M2 will apply
  HttpRouter.get("/e", HttpServerResponse.text("e")), // Middleware M4, M2 will apply
  HttpRouter.get("/f", HttpServerResponse.text("f")), // Middleware M4, M2 will apply
  // Apply Middleware at the router level
  HttpRouter.use(withMiddleware("M2"))
)

// Main router combining Router1 and Router2
const router = HttpRouter.empty.pipe(
  HttpRouter.mount("/r1", router1),
  // Apply Middleware affecting all routes under /r1
  HttpRouter.use(withMiddleware("M3")),
  HttpRouter.get("/g", HttpServerResponse.text("g")), // Only Middleware M4 will apply
  HttpRouter.mount("/r2", router2),
  // Apply Middleware affecting all routes
  HttpRouter.use(withMiddleware("M4"))
)

// Configure the application with the server middleware
const app = router.pipe(HttpServer.serve())

listen(app, 3000)
```

**Testing the Middleware**

To ensure that the middleware is working as expected, you can test it by making HTTP requests to the defined routes and checking the console output for middleware logs:

```sh
# Test route /a under router1
curl -i http://localhost:3000/r1/a
# Expected console output: M4 M3 M1

# Test route /c under router1
curl -i http://localhost:3000/r1/c
# Expected console output: M4 M3

# Test route /d under router2
curl -i http://localhost:3000/r2/d
# Expected console output: M4 M2

# Test route /g under the main router
curl -i http://localhost:3000/g
# Expected console output: M4
```

### Applying Middleware at the Server Level

Applying middleware at the server level allows you to introduce certain functionalities, such as logging, authentication, or general request processing, that affect every request handled by the server. This ensures that all incoming requests, regardless of the route, pass through the applied middleware, making it an essential feature for global error handling, logging, or authentication.

**Example**

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { Effect } from "effect"
import { listen } from "./listen.js"

// Middleware constructor that logs the name of the middleware
const withMiddleware = (name: string) =>
  HttpMiddleware.make((app) =>
    Effect.gen(function* () {
      console.log(name) // Log the middleware name when the route is accessed
      return yield* app // Continue with the original application flow
    })
  )

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/a", HttpServerResponse.text("a").pipe(withMiddleware("M1"))),
  HttpRouter.get("/b", HttpServerResponse.text("b")),
  HttpRouter.use(withMiddleware("M2")),
  HttpRouter.get("/", HttpServerResponse.text("root"))
)

const app = router.pipe(HttpServer.serve(withMiddleware("M3")))

listen(app, 3000)
```

**Testing the Middleware**

To confirm the middleware is functioning as intended, you can send HTTP requests to the defined routes and check the console for middleware logs:

```sh
# Test route /a and observe the middleware logs
curl -i http://localhost:3000/a
# Expected console output: M3 M2 M1  - Middleware M3 (server-level), M2 (router-level), and M1 (route-level) apply.

# Test route /b and observe the middleware logs
curl -i http://localhost:3000/b
# Expected console output: M3 M2  - Middleware M3 (server-level) and M2 (router-level) apply.

# Test route / and observe the middleware logs
curl -i http://localhost:3000/
# Expected console output: M3 M2  - Middleware M3 (server-level) and M2 (router-level) apply.
```

### Applying Multiple Middlewares

Middleware functions are simply functions that transform a `Default` app into another `Default` app. This flexibility allows for stacking multiple middleware functions, much like composing functions in functional programming. The `flow` function from the `Effect` library facilitates this by enabling function composition.

**Example**

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { Effect, flow } from "effect"
import { listen } from "./listen.js"

// Middleware constructor that logs the middleware's name when a route is accessed
const withMiddleware = (name: string) =>
  HttpMiddleware.make((app) =>
    Effect.gen(function* () {
      console.log(name) // Log the middleware name
      return yield* app // Continue with the original application flow
    })
  )

// Setup routes and apply multiple middlewares using flow for function composition
const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/a",
    HttpServerResponse.text("a").pipe(
      flow(withMiddleware("M1"), withMiddleware("M2"))
    )
  ),
  HttpRouter.get("/b", HttpServerResponse.text("b")),
  // Apply combined middlewares to the entire router
  HttpRouter.use(flow(withMiddleware("M3"), withMiddleware("M4"))),
  HttpRouter.get("/", HttpServerResponse.text("root"))
)

// Apply combined middlewares at the server level
const app = router.pipe(
  HttpServer.serve(flow(withMiddleware("M5"), withMiddleware("M6")))
)

listen(app, 3000)
```

**Testing the Middleware Composition**

To verify that the middleware is functioning as expected, you can send HTTP requests to the routes and check the console for the expected middleware log output:

```sh
# Test route /a to see the output from multiple middleware layers
curl -i http://localhost:3000/a
# Expected console output: M6 M5 M4 M3 M2 M1

# Test route /b where fewer middleware are applied
curl -i http://localhost:3000/b
# Expected console output: M6 M5 M4 M3

# Test the root route to confirm top-level middleware application
curl -i http://localhost:3000/
# Expected console output: M6 M5
```

## Built-in middleware

### Middleware Summary

| Middleware            | Description                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Logger**            | Provides detailed logging of all requests and responses, aiding in debugging and monitoring application activities.               |
| **xForwardedHeaders** | Manages `X-Forwarded-*` headers to accurately maintain client information such as IP addresses and host names in proxy scenarios. |

### logger

The `HttpMiddleware.logger` middleware enables logging for your entire application, providing insights into each request and response. Here's how to set it up:

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { listen } from "./listen.js"

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello World"))
)

// Apply the logger middleware globally
const app = router.pipe(HttpServer.serve(HttpMiddleware.logger))

listen(app, 3000)
/*
curl -i http://localhost:3000
timestamp=... level=INFO fiber=#0 message="Listening on http://0.0.0.0:3000"
timestamp=... level=INFO fiber=#19 message="Sent HTTP response" http.span.1=8ms http.status=200 http.method=GET http.url=/
timestamp=... level=INFO fiber=#20 cause="RouteNotFound: GET /favicon.ico not found
    at ...
    at http.server GET" http.span.2=4ms http.status=500 http.method=GET http.url=/favicon.ico
*/
```

To disable the logger for specific routes, you can use `HttpMiddleware.withLoggerDisabled`:

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { listen } from "./listen.js"

// Create the router with routes that will and will not have logging
const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello World")),
  HttpRouter.get(
    "/no-logger",
    HttpServerResponse.text("no-logger").pipe(HttpMiddleware.withLoggerDisabled)
  )
)

// Apply the logger middleware globally
const app = router.pipe(HttpServer.serve(HttpMiddleware.logger))

listen(app, 3000)
/*
curl -i http://localhost:3000/no-logger
timestamp=2024-05-19T09:53:29.877Z level=INFO fiber=#0 message="Listening on http://0.0.0.0:3000"
*/
```

### xForwardedHeaders

This middleware handles `X-Forwarded-*` headers, useful when your app is behind a reverse proxy or load balancer and you need to retrieve the original client's IP and host information.
**WARNING:** The `X-Forwarded-*` headers are untrustworthy when no trusted reverse proxy or load balancer is between the client and server.

```ts
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse
} from "@effect/platform"
import { Effect } from "effect"
import { listen } from "./listen.js"

// Create a router and a route that logs request headers and remote address
const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest
      console.log(req.headers)
      console.log(req.remoteAddress)
      return yield* HttpServerResponse.text("Hello World")
    })
  )
)

// Set up the server with xForwardedHeaders middleware
const app = router.pipe(HttpServer.serve(HttpMiddleware.xForwardedHeaders))

listen(app, 3000)
/*
curl -H "X-Forwarded-Host: 192.168.1.1" -H "X-Forwarded-For: 192.168.1.1" http://localhost:3000
timestamp=... level=INFO fiber=#0 message="Listening on http://0.0.0.0:3000"
{
  host: '192.168.1.1',
  'user-agent': 'curl/8.6.0',
  accept: '*\/*',
  'x-forwarded-host': '192.168.1.1',
  'x-forwarded-for': '192.168.1.1'
}
{ _id: 'Option', _tag: 'Some', value: '192.168.1.1' }
*/
```

## Error Handling

### Catching Errors

Below is an example illustrating how to catch and manage errors that occur during the execution of route handlers:

```ts
import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import { listen } from "./listen.js"

// Define routes that might throw errors or fail
const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/throw",
    Effect.sync(() => {
      throw new Error("BROKEN") // This will intentionally throw an error
    })
  ),
  HttpRouter.get("/fail", Effect.fail("Uh oh!")) // This will intentionally fail
)

// Configure the application to handle different types of errors
const app = router.pipe(
  Effect.catchTags({
    RouteNotFound: () =>
      HttpServerResponse.text("Route Not Found", { status: 404 })
  }),
  Effect.catchAllCause((cause) =>
    HttpServerResponse.text(cause.toString(), { status: 500 })
  ),
  HttpServer.serve()
)

listen(app, 3000)
```

You can test the error handling setup with `curl` commands by trying to access routes that trigger errors:

```sh
# Accessing a route that does not exist
curl -i http://localhost:3000/nonexistent

# Accessing the route that throws an error
curl -i http://localhost:3000/throw

# Accessing the route that fails
curl -i http://localhost:3000/fail
```

## Validations

Validation is a critical aspect of handling HTTP requests to ensure that the data your server receives is as expected. We'll explore how to validate headers and cookies using the `@effect/platform` and `effect/Schema` libraries, which provide structured and robust methods for these tasks.

### Headers

Headers often contain important information needed by your application, such as content types, authentication tokens, or session data. Validating these headers ensures that your application can trust and correctly process the information it receives.

```ts
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse
} from "@effect/platform"
import { Effect, Schema } from "effect"
import { listen } from "./listen.js"

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.gen(function* () {
      // Define the schema for expected headers and validate them
      const headers = yield* HttpServerRequest.schemaHeaders(
        Schema.Struct({ test: Schema.String })
      )
      return yield* HttpServerResponse.text("header: " + headers.test)
    }).pipe(
      // Handle parsing errors
      Effect.catchTag("ParseError", (e) =>
        HttpServerResponse.text(`Invalid header: ${e.message}`)
      )
    )
  )
)

const app = router.pipe(HttpServer.serve())

listen(app, 3000)
```

You can test header validation using the following `curl` commands:

```sh
# Request without the required header
curl -i http://localhost:3000

# Request with the valid header
curl -i -H "test: myvalue" http://localhost:3000
```

### Cookies

Cookies are commonly used to maintain session state or user preferences. Validating cookies ensures that the data they carry is intact and as expected, enhancing security and application integrity.

Here's how you can validate cookies received in HTTP requests:

```ts
import {
  Cookies,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse
} from "@effect/platform"
import { Effect, Schema } from "effect"
import { listen } from "./listen.js"

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.gen(function* () {
      const cookies = yield* HttpServerRequest.schemaCookies(
        Schema.Struct({ test: Schema.String })
      )
      return yield* HttpServerResponse.text("cookie: " + cookies.test)
    }).pipe(
      Effect.catchTag("ParseError", (e) =>
        HttpServerResponse.text(`Invalid cookie: ${e.message}`)
      )
    )
  )
)

const app = router.pipe(HttpServer.serve())

listen(app, 3000)
```

Validate the cookie handling with the following `curl` commands:

```sh
# Request without any cookies
curl -i http://localhost:3000

# Request with the valid cookie
curl -i http://localhost:3000 --cookie "test=myvalue"
```

## ServerRequest

### How do I get the raw request?

The native request object depends on the platform you are using, and it is not directly modeled in `@effect/platform`. Instead, you need to refer to the specific platform package you are working with, such as `@effect/platform-node` or `@effect/platform-bun`.

Here is an example using Node.js:

```ts
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse
} from "@effect/platform"
import { NodeHttpServer, NodeHttpServerRequest } from "@effect/platform-node"
import { Effect } from "effect"
import { listen } from "./listen.js"

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest
      const raw = NodeHttpServerRequest.toIncomingMessage(req)
      console.log(raw)
      return HttpServerResponse.empty()
    })
  )
)

listen(HttpServer.serve(router), 3000)
```

## Conversions

### toWebHandler

The `toWebHandler` function converts a `Default` (i.e. a type of `HttpApp` that specifically produces a `ServerResponse` as its output) into a web handler that can process `Request` objects and return `Response` objects.

```ts
import { HttpApp, HttpRouter, HttpServerResponse } from "@effect/platform"

// Define the router with some routes
const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("content 1")),
  HttpRouter.get("/foo", HttpServerResponse.text("content 2"))
)

// Convert the router to a web handler
// const handler: (request: Request) => Promise<Response>
const handler = HttpApp.toWebHandler(router)

// Test the handler with a request
const response = await handler(new Request("http://localhost:3000/foo"))
console.log(await response.text()) // Output: content 2
```
