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

Consult the [wiki](https://github.com/MartinDrost/nest-utilities/wiki) for more detailed documentation.

## Features
### Endpoints
Extending your controllers with the `CrudController` will give you access to a set of basic Restful endpoints. [Learn more](https://github.com/MartinDrost/nest-utilities/wiki/Controller-abstract).


### Query parameters
The aforementioned `CrudController` will also extend all generated `GET` methods with a set of query parameter actions. These actions will give applications requesting data from the API more options and will prevent having to write unnecessary custom endpoints. [Learn more](https://github.com/MartinDrost/nest-utilities/wiki/Query-parameters).


### Service methods
Extending your services with the `CrudService` will give you access to a set of methods which helps you streamline your development and keep your service clean. [Learn more](https://github.com/MartinDrost/nest-utilities/wiki/Service-abstract).
