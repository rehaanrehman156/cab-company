# AWS Amplify deployment

## Steps

1. Push the repository to GitHub.
2. Open the AWS Amplify Console.
3. Create a new app and connect the repository.
4. Set the app root to `/` and use the build spec file at the repository root: `amplify.yml`.
5. Deploy the app.

## Build configuration

The project uses the Amplify build file at the repository root:

- [amplify.yml](../../amplify.yml)

## Local validation

Run:

```bash
cd frontend/customer-app
npm run build
```
