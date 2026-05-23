# Plugins

MyApp uses PluginForge to load optional features as standalone packages.

## What is a plugin?

A plugin is a Python package registered under the `myapp.plugins` entry-point group. The host loads it at startup, calls its hooks, and may expose UI extensions declared in the plugin's frontend manifest.

## Installing a plugin

Open **Settings > Plugins**, click **Install plugin**, and select the plugin ZIP. The plugin name must use lowercase letters, digits, and hyphens only.

## Configuring a plugin

Plugin settings live in `backend/config/plugins/{name}.yaml`. Settings that should be user-editable are exposed in **Settings > Plugins > {plugin name}**. Settings marked `# INTERNAL` are YAML-only.

## Disabling a plugin

In **Settings > Plugins**, switch the plugin off. It stays installed but no hooks fire and no UI slots mount.

> This is a placeholder page. Customize it with the plugins your project ships.
