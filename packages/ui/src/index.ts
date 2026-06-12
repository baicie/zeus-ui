// Entry point that triggers registration of all styled Web Components.
// Relative imports ensure the bundle can be built without circular resolution issues.
import './button'
import './input'
// Consumers should import @zeus-web/ui/button or @zeus-web/ui/input directly
// to ensure custom element registration side effects are not tree-shaken.
