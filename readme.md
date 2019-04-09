![npm](https://img.shields.io/npm/dt/nest-utilities.svg)
![npm](https://img.shields.io/npm/v/nest-utilities.svg)

## Introduction

The nest-utilities package is meant as a helper layer for your Nest application. The package offers classes to create consistency in your code and to prevent repeating menial tasks and repetetive coding like writing CRUD functionalities.

## CrudService (requires mongoose)

The CrudService is an abstract class which you can use to extend your model services. When a service extends this class it has to provide the CrudService the Mongoose schema of the model you want the service to alter.

```js
@Injectable()
export class UserService extends CrudService<IUserModel> {
  constructor(
    @InjectModel("User") private readonly userModel: Model<IUserModel>
  ) {
    super(userModel);
  }
}
```

Afterwards, the service extending the CrudService will contain all basic functionalities you need to manage the implemented schema.

### Overriding methods

Should another action need to occur before, for example, creating a user, you can simply override the method in the service.

```js
@Injectable()
export class UserService extends CrudService<IUserModel> {
  constructor(
    @InjectModel("User") private readonly userModel: Model<IUserModel>
  ) {
    super(userModel);
  }

  // override the create method to perform additional actions
  public create(user: IUserModel): Promise<IUserModel> {
    user.role = Role.User;
    return super.create(user);
  }
}
```

### Populating data

Populating in Mongoose brings some inconsistency when using the default library method. Because of this, nest-utilities offers an own implementation which solves some basic issues. When you want to use the populate method you always have to override the default method in order to declare the fields which need to be populated and which of those fields are arrays.

```js
@Injectable()
export class UserService extends CrudService<IUserModel> {
  constructor(
    @InjectModel("User") private readonly userModel: Model<IUserModel>
  ) {
    super(userModel);
  }

  public populate(user: IUserModel): Promise<IUserModel> {
    const paths = ["partner", "siblings"];
    const arrays = ["siblings"];
    return super.populate(user, paths, arrays);
  }
}
```

## CrudController

The CrudController is an abstract class which you can use to extend your model controllers. When a controller extends this class it has to provide the CrudController the (Crud)service of the model you want the service to alter and optionally the guards which have to be applied on certain actions. Just like the CrudService, you are able to override the methods of the CrudController in order to implement additional functionalities to existing endpoints.

```js
@Controller("user")
export class UserController extends CrudController<IUserModel> {
  constructor(private readonly userService: UserService) {
    super(userService, {
      create: {
        guards: [RolesGuard],
        data: { roles: [Role.ADMIN, Role.MODERATOR] },
      },
      read: {
        guards: [RolesGuard],
        data: { roles: [] },
      },
      update: {
        guards: [RolesGuard],
        data: { roles: [Role.ADMIN, Role.MODERATOR] },
      },
      delete: {
        guards: [RolesGuard],
        data: { roles: [Role.ADMIN] },
      },
    });
  }
}
```

Be aware that using parameters in your guards as a security measure requires you to activate the ContextInterceptor (see Interceptors) and make your guard check the context["metadata"] for the parameters.

```js
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const roles = context["metadata"]
      ? context["metadata"].roles
      : this.reflector.get<string[]>("roles", context.getHandler());

    ...
  }
}
```

Implementing the CrudController opens up the following endpoints for the controller:

|                | Method | URL        |
| -------------- | ------ | ---------- |
| Create         | POST   | /          |
| Get by id      | GET    | /:id       |
| Get many by id | GET    | /many/:ids |
| Get all        | GET    | /          |
| Update         | PUT    | /          |
| Delete         | DELETE | /:id       |

## Interceptors

Nest-utilities offers a number of interceptors to make retrieving data more consistent and data friendly. These interceptors will have to be activated in the main.ts of your application. Ideally this would look as follows:

```js
// order and enable global interceptors (order does matter)
app.useGlobalInterceptors(new ContextInterceptor());
app.useGlobalInterceptors(new FilterInterceptor());
app.useGlobalInterceptors(new SearchInterceptor());
app.useGlobalInterceptors(new PickInterceptor());
app.useGlobalInterceptors(new SortInterceptor());
app.useGlobalInterceptors(new PaginationInterceptor());
app.useGlobalInterceptors(new CsvInterceptor());
app.useGlobalInterceptors(new ExceptionInterceptor());

await app.listen(3000);
```

Or, if you want all interceptors enabled:

```js
// enable all interceptors in one line
useAllInterceptors(app);

await app.listen(3000);
```

The following interceptors are available:

| Name                  | Description                                                                                                                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ContextInterceptor    | Required to deliver parameters to the guards when using the CrudController.                                                                                                                                                                                                             |
| FilterInterceptor     | Used to filter returned object arrays by key values. "..user?filter[name]=john" would only return users with "john" in their name. Multiple filters are possible by adding additional query parameters.                                                                                 |
| SortInterceptor       | Used to sort returned object arrays by key values. "..user?sort=name,-age" would sort the response on the users names ascending and age descending.                                                                                                                                     |
| PaginationInterceptor | Used to implement pagination. "..user?offset=5&limit=10" would return a maximum of 10 users while skipping the first 5.                                                                                                                                                                 |
| PickInterceptor       | Pick a certain selection of attributes from a response omitting the rest. f.e.: ..user?pick=firstName,lastName,children.firstName                                                                                                                                                       |
| SearchInterceptor     | Search an array of object for ones containing the given query in the provided attributes (searchScope). Note that the searchScope parameter is optional and that the whole object will be searched if it's not provided. f.e.: ..user?search=cat&searchScope=firstName,lastName,address |
| CsvInterceptor        | Used to return the response array in CSV format instead of JSON. "..user?csv" would return a CSV.                                                                                                                                                                                       |
| ExceptionInterceptor  | Catches all uncaught exceptions and throws them as status 400 HttpExceptions.                                                                                                                                                                                                           |
