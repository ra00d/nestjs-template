// Tells the package the application's user type once; from then on
// `@CurrentUser('key')` accepts only keys of `User` and is typed to return
// that property, and `AuthenticationContext.user` and `.session` are typed

import { User } from './user.js';

// too. It's one user type for the whole application.
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}

