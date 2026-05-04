<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">
A package which supplements <a href="https://nestjs.com/">NestJS</a> applications with out-of-the-box CRUD endpoints, rich query parameters, and ergonomic glue for <a href="https://github.com/MartinDrost/fundering">Fundering</a>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nest-utilities"><img src="https://img.shields.io/npm/dt/nest-utilities.svg" alt="NPM Downloads" /></a>
  <a href="https://www.npmjs.com/package/nest-utilities"><img src="https://img.shields.io/npm/v/nest-utilities.svg" alt="NPM Version" /></a>
</p>

## Description

When building NestJS APIs you usually find yourself writing the same CRUD plumbing for every module. **nest-utilities** removes that boilerplate by giving you:

- An abstract `CrudController` that wraps a `fundering` `CrudService` and exposes ready-to-go create / read / update / delete handlers.
- A `@QueryOptions()` parameter decorator that turns HTTP query strings (or a JSON header) into Mongoose-friendly options — including filtering, sorting, pagination, projection, population and aggregation `$addFields`.
- An `HttpExceptionFilter` that produces consistent error payloads.
- A handful of small interfaces, constants and utilities that make the above safe and predictable.

The package is intentionally thin: persistence, hooks and authorisation logic live in [`fundering`](https://github.com/MartinDrost/fundering); nest-utilities is the HTTP-side adapter on top of it.

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [API reference](#api-reference)
  - [`CrudController<ModelType>`](#crudcontrollermodeltype)
  - [`@QueryOptions()`](#queryoptions)
  - [`HttpExceptionFilter`](#httpexceptionfilter)
  - [Interfaces](#interfaces)
  - [Custom operators](#custom-operators)
  - [Utilities](#utilities)
- [Query parameters](#query-parameters)
- [Recipes](#recipes)
- [Compatibility](#compatibility)

## Installation

```bash
npm install nest-utilities fundering
```

`nest-utilities` ships TypeScript types out of the box. The peer dependencies are:

| Package          | Version    |
| ---------------- | ---------- |
| `@nestjs/common` | `>= 8.0.0` |
| `@nestjs/core`   | `>= 8.0.0` |
| `fundering`      | `>= 1.3.0` |
| `mongoose`       | `>= 5.12.0`|
| `rxjs`           | `>= 7.1.0` |

Make sure those are already installed in your NestJS project.

## Quick start

The example below wires up a fully functional `/users` resource with filtering, sorting, pagination and population, while still letting you customise individual endpoints when needed.

```ts
// user.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema()
export class User extends Document {
  @Prop() firstName: string;
  @Prop() lastName: string;
  @Prop() email: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
```

```ts
// user.service.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { CrudService } from "fundering";
import { Model } from "mongoose";
import { User } from "./user.schema";

@Injectable()
export class UserService extends CrudService<User> {
  constructor(@InjectModel(User.name) userModel: Model<User>) {
    super(userModel);
  }
}
```

```ts
// user.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import {
  CrudController,
  IExpressQueryOptions,
  QueryOptions,
} from "nest-utilities";
import { User } from "./user.schema";
import { UserService } from "./user.service";

@Controller("users")
export class UserController extends CrudController<User> {
  constructor(userService: UserService) {
    super(userService);
  }

  @Post()
  create(@Body() user: User, @QueryOptions() options: IExpressQueryOptions) {
    return this.handleCreate(user, options);
  }

  @Get()
  find(@QueryOptions() options: IExpressQueryOptions) {
    return this.handleFind(options.match ?? {}, options);
  }

  @Get(":id")
  findById(
    @Param("id") id: string,
    @QueryOptions() options: IExpressQueryOptions,
  ) {
    return this.handleFindById(id, options);
  }

  @Put(":id")
  put(
    @Param("id") id: string,
    @Body() user: User,
    @QueryOptions() options: IExpressQueryOptions,
  ) {
    return this.handlePut(user, id, options);
  }

  @Patch(":id")
  patch(
    @Param("id") id: string,
    @Body() user: Partial<User>,
    @QueryOptions() options: IExpressQueryOptions,
  ) {
    return this.handlePatch(user, id, options);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @QueryOptions() options: IExpressQueryOptions,
  ) {
    return this.handleDelete(id, options);
  }
}
```

That's it. The endpoints now accept the [query parameters](#query-parameters) listed below, automatically expose `X-Total-Count` when asked for, and route every error through Nest's standard exception flow.

## API reference

### `CrudController<ModelType>`

Abstract class you extend in your own controller. It receives a `fundering` `CrudService` in its constructor and exposes the following handlers — none of them register routes for you, you wire them up with the usual Nest decorators (`@Get`, `@Post`, etc.). All handlers accept an `IExpressQueryOptions` argument so authorisation hooks inside `fundering` get access to the original `Request` and `Response`.

| Handler             | Signature                                                                              | Notes                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `handleCreate`      | `(model, options?) => Promise<ModelType>`                                              | Wraps `crudService.create`.                                                                                          |
| `handleCreateMany`  | `(models, options?) => Promise<ModelType[]>`                                           | Wraps `crudService.createMany`.                                                                                      |
| `handleFind`        | `(conditions, options?) => Promise<ModelType[]>`                                       | If `options.includeCount` is true, calls `crudService.count` first so the `X-Total-Count` header gets populated.     |
| `handleFindById`    | `(id, options?) => Promise<ModelType>`                                                 | Throws `NotFoundException("No model found")` if the document is not visible to the requester.                       |
| `handlePut`         | `(model, id?, options?) => Promise<ModelType>`                                         | Validates visibility via `handleFindById` before replacing the document.                                             |
| `handlePutMany`     | `(models, options?) => Promise<ModelType[]>`                                           | Validates visibility for each model, then replaces them in bulk.                                                     |
| `handlePatch`       | `(partial, id?, options?) => Promise<ModelType>`                                       | Validates visibility, then merges (`crudService.mergeModel`).                                                        |
| `handlePatchMany`   | `(partials, options?) => Promise<ModelType[]>`                                         | Validates visibility for each, then bulk merges.                                                                     |
| `handleDelete`      | `(id, options?) => Promise<ModelType \| null>`                                         | Validates visibility, then removes via `crudService.deleteById`.                                                     |

When the constructor runs, an `addCountHeaderHook` is attached to the underlying service. It hooks into `fundering`'s `postCount` lifecycle and sets two response headers when a count is performed:

- `X-Total-Count: <number>`
- `Access-Control-Expose-Headers: X-Total-Count, ...` (existing values are preserved)

### `@QueryOptions()`

A NestJS parameter decorator that converts the incoming HTTP request into an `IExpressQueryOptions` object. Two transport modes are supported:

1. **Query string** — the default. Use bracket notation for nested keys, e.g. `?match[firstName]=John&limit=10`.
2. **Header** — set `x-query-options` to a JSON-encoded `IHttpOptions` object. Useful when you would exceed URL length limits or want to send deeply nested filters cleanly.

The decorator accepts an optional `IQueryOptionsConfig`:

```ts
@Get()
find(
  @QueryOptions({ maxDepth: 5 }) options: IExpressQueryOptions,
) { ... }
```

`maxDepth` (default `3`) caps how deeply the parser will recurse into `match` filters and `populate` paths to keep accidental N+1 explosions in check.

The returned object is the parsed `IQueryOptions` plus the original `request` and `response`, so authorisation hooks downstream in `fundering` can inspect them.

### `HttpExceptionFilter`

A `@Catch()`-all filter that normalises errors into JSON. Pass `showErrorDetails` in the constructor to control whether stack traces and original messages leak to the client (typical pattern: `process.env.NODE_ENV !== "production"`).

```ts
// main.ts
import { HttpExceptionFilter } from "nest-utilities";

const app = await NestFactory.create(AppModule);
app.useGlobalFilters(
  new HttpExceptionFilter(process.env.NODE_ENV !== "production"),
);
```

Behaviour:

- Instances of `HttpException` are forwarded with their original status and body.
- Anything else becomes `{ status: 500, message: "Internal server error" }`. When `showErrorDetails` is `true`, the response also contains `message` (the original error message) and `stack`.

### Interfaces

```ts
// re-exported from the package root
import {
  IModel,
  IExpressQueryOptions,
  IHttpOptions,
  IQueryOptionsConfig,
} from "nest-utilities";
```

- **`IModel`** — `{ id?: any; _id?: any }`. The minimum shape `CrudController` requires from your model type.
- **`IExpressQueryOptions`** — extends `fundering`'s `IQueryOptions` with `request`, `response` and `includeCount`. This is what `@QueryOptions()` injects.
- **`IHttpOptions`** — describes the raw HTTP query string shape (the thing the user sends; see [Query parameters](#query-parameters)).
- **`IQueryOptionsConfig`** — `{ maxDepth?: number }`, accepted by `@QueryOptions()`.

### Custom operators

`nest-utilities` exposes one custom MongoDB-style operator out of the box:

- **`$isNull`** — `?match[deletedAt][$isNull]=true` becomes `{ deletedAt: { $eq: null } }`. Truthy values (`true`, `"true"`, `1`, `"1"`) check for `null`; everything else inverts to `{ $ne: null }`.

The operator table is exported as `customOperators` from the package root if you want to extend it in your own utilities.

### Utilities

- **`queryToOptions(query, config?)`** — the parsing function used internally by `@QueryOptions()`. Useful in tests or when you want the same parsing behaviour outside of a request context.
- **`addCountHeaderHook(service)`** — attaches the `X-Total-Count` response hook to a `CrudService`. `CrudController` calls this for you, but you can call it directly if you bypass the controller abstraction.

## Query parameters

Every handler that goes through `@QueryOptions()` accepts the parameters below. They map to stages of the MongoDB aggregation pipeline.

| Param          | Type                                | Description                                                                                          |
| -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `match`        | `Record<string, any>`               | `$match` filter. Supports MongoDB operators (`$in`, `$gt`, `$regex`, …) and the `$isNull` extension. |
| `sort`         | `string[]`                          | `$sort`. Prefix a field with `-` for descending: `?sort=-createdAt&sort=lastName`.                   |
| `skip`         | `number`                            | `$skip`. Use for pagination.                                                                         |
| `offset`       | `number` (deprecated)               | Alias for `skip`. Will be removed in a future major.                                                 |
| `limit`        | `number`                            | `$limit`.                                                                                            |
| `select`       | `string[]`                          | `$project`. Dot notation supported: `?select=name&select=address.city`.                              |
| `populate`     | `(string \| IPopulateOptions)[]`    | Mongoose-style populate. Strings allow dot notation; objects allow `match`/`sort`/`limit` per join.  |
| `addFields`    | `Record<string, any>`               | `$addFields` stage; usable in subsequent `match`/`sort`.                                             |
| `distinct`     | `string \| string[]`                | Returns unique values for the given field(s).                                                        |
| `random`       | `boolean`                           | When truthy, returns documents in random order (overrules `sort`).                                   |
| `includeCount` | `boolean`                           | When `true`, the response sets `X-Total-Count` to the unpaginated match count.                       |
| `custom`       | `Record<string, any>`               | Free-form bag forwarded to `fundering` hooks for application-specific behaviour.                     |

**Primitive coercion**. By default every query string value is a string. Wrap a value in `{{ }}` to coerce it: `{{42}}`, `{{true}}`, `{{null}}`, `{{undefined}}`. This is the canonical way to do `?match[isPublished]={{true}}` instead of receiving the literal string `"true"`.

**Depth limits**. `match` keys deeper than `maxDepth` (default 3) are silently dropped, and `populate` paths are truncated. Bump `maxDepth` per-decorator if you need more.

**Header transport**. For complex queries, send a single `x-query-options` header containing a JSON-stringified `IHttpOptions`:

```http
GET /users
x-query-options: {"match":{"firstName":{"$in":["John","Jane"]}},"limit":10}
```

## Recipes

### Pagination with total count

Tell the server you want the count, then read it from the response header on the client.

```http
GET /users?limit=20&skip=40&includeCount=true
```

The response includes `X-Total-Count: 137`. The header is also added to `Access-Control-Expose-Headers` so browsers can read it cross-origin.

### Filtering and sorting

```http
GET /users?match[firstName][$regex]=^Jo&sort=-createdAt&sort=lastName
```

### Populating relationships with conditions

Use the header transport for nested options:

```json
{
  "populate": [
    {
      "path": "school",
      "match": { "active": "{{true}}" },
      "populate": [{ "path": "students", "limit": 5 }]
    }
  ]
}
```

### Selecting a subset of fields

```http
GET /users?select=firstName&select=lastName&select=address.city
```

### Distinct values

```http
GET /users?distinct=email
```

### Custom-operator null check

```http
GET /users?match[deletedAt][$isNull]=true
```

### Random sample

```http
GET /quotes?limit=5&random=true
```

### Per-controller `maxDepth` override

```ts
@Get()
find(
  @QueryOptions({ maxDepth: 6 }) options: IExpressQueryOptions,
) {
  return this.handleFind(options.match ?? {}, options);
}
```

### Centralised error responses

```ts
// main.ts
app.useGlobalFilters(
  new HttpExceptionFilter(process.env.NODE_ENV !== "production"),
);
```

In production, all unhandled errors are masked behind a `500 Internal server error`. In development you get the original message and stack to debug with.

### Bypassing the controller for service calls

`addCountHeaderHook` works on any `CrudService` instance, so you can keep using the same response-header behaviour even when you call services directly from a non-CRUD controller:

```ts
import { addCountHeaderHook } from "nest-utilities";

constructor(private userService: UserService) {
  addCountHeaderHook(this.userService);
}
```

## Compatibility

Built and tested against:

- NestJS `>= 8`
- Mongoose `>= 5.12`
- Fundering `>= 1.3`
- RxJS `>= 7.1`

The package is published as CommonJS (`distribution/index.js`) with bundled type declarations (`distribution/index.d.ts`).

## License

ISC © [MartinDrost](https://github.com/MartinDrost)

For deeper guides and migration notes, see the [wiki](https://github.com/MartinDrost/nest-utilities/wiki) and the issue tracker.
