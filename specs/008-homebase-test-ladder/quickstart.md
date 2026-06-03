# Homebase Test Ladder Quickstart

Run the main QA gate first when you want current proof:

```bash
npm run check:homebase
```

Then print the test ladder:

```bash
npm run homebase:test-ladder
```

Expected shape:

```text
Homebase test ladder
Latest QA: ok/ok; public auth enforced

Need
gap     Live Teddy bridge contract - ...
partial Real-device saved login - ...
ok      Incident ranking golden pack - ...

Want
...

Dream
...
```
