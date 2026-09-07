# Togetherly Watch Bridge autolink hotfix

Adds the local `togetherly-watch-bridge` Expo module as an explicit file dependency and gives the module package metadata so Expo autolinking discovers its Swift implementation during iOS prebuild.

After extracting over the project:

```cmd
npm install
git add package.json package-lock.json modules/togetherly-watch-bridge/package.json
git commit -m "Autolink Togetherly Watch bridge"
git push
```

The GitHub workflow also runs npm install, but running it locally ensures package-lock.json records the local module before committing.
