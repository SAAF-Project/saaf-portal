# Contributing to the SAAF Portal

Thanks for helping build the SAAF Portal! A few things to know before you open a pull request.

## Contributor licence agreement

The portal is maintained by Stichting SAAF (in formation), which will publish its licence terms (see [LICENSE](LICENSE)). So that the foundation can license the portal, including your contribution, every contributor signs the [Contributor Licence Agreement](CLA.md) once.

To sign, add this comment to your first pull request:

> I have read the SAAF Contributor Licence Agreement and I agree to it.

Once the final agreement is published, pull requests are merged only after it has been signed.

## Pull requests

- Branch naming: `your-name/feature-description`.
- Before you push, run `npx tsc --noEmit`, `npm run lint`, `npm test` and `npm run build`.
- Don't commit real audit evidence, personal data or credentials. Use synthetic or anonymised data.
- At least one maintainer review is needed before merge.
