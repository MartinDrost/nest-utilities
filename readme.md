<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">
A package which supplements <a href="https://nestjs.com/">NestJS</a> applications with out of the box CRUD functionality and parameter actions.
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/nest-utilities"><img src="https://img.shields.io/npm/dt/nest-utilities.svg" alt="NPM Downloads" /></a>
  <a href="https://www.npmjs.com/package/nest-utilities"><img src="https://img.shields.io/npm/v/nest-utilities.svg" alt="NPM Version" /></a>
</p>

## Description
In order to keep consistency in CRUD applications you often find yourself writing the same functionality for each new module. Nest-utilities offers a set of basic endpoints and query parameters out of the box while keeping module specific authentication and data manipulation in mind.

Nest-utilities aims for performance and developer experience to keep you focused on building features instead of implementing menial tasks.

## Examples
### Endpoints
Extending your controllers with the `CrudController` will give you access to a set of basic Restful endpoints. 

|                 | Method | URL          |
| --------------- | ------ | ------------ |
| Create model    | POST   | /            |
| Get model by id | GET    | /:id         |
| Get many by id  | GET    | /many/:ids   |
| Get all         | GET    | /            |
| Overwrite model | PUT    | /:id?        |
| Merge model     | PATCH  | /:id?        |
| Delete model    | DELETE | /:id         |

### Query parameters
The aforementioned `CrudController` will also extend all generated `GET` methods with a set of query parameter actions. These actions will give applications requesting data from the API more options and will prevent having to write unnecessary custom endpoints.

|                    | key            | value        |
| ------------------ | -------------- | ------------ |
| Populate fields    | populate       | string[]     |
| Filter response    | filter[:field] | string       |
| Search models      | search         | string       |
| Search scope       | searchScope    | string[]     |
| Pick fields        | pick           | string[]     |
| Sort response      | sort           | string[]     |
| Offset response    | offset         | number       |
| Limit response     | limit          | number       |

### Service methods
Extending your services with the `CrudService` will give you access to a set of methods which helps you streamline your development and keep your service clean.

|                                                      | Method          |
| ---------------------------------------------------- | --------------- |
| Create a model                                       | create          |
| Create if not present                                | createOrPatch   |
| Get model by id                                      | get             |
| Get many by id                                       | getMany         |
| Find by mongoose conditions                          | find            |
| Find single by mongoose conditions                   | findOne         |
| Overwrite model                                      | put             |
| Merge model                                          | patch           |
| Delete model                                         | delete          |
| Delete models by mongoose conditions                 | findAndDelete   |
| Populate fields                                      | populate        |
| Populate fields for list                             | populateList    |
| Hook which is called before saving a model           | preSave         |
| Hook which is called before creating a model         | onCreateRequest |
| Hook which is called before executing a find request | onFindRequest   |
| Hook which is called before updating a model         | onUpdateRequest |
| Hook which is called before deleting a model         | onDeleteRequest |
