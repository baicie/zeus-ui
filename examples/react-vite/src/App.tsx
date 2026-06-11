import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Switch } from './components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'

export function App() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Zeus Web</p>
        <h1>React Vite Example</h1>
        <p>
          This example validates the React wrapper and registry-like local UI
          usage path.
        </p>
      </section>

      <section className="panel">
        <h2>Button</h2>
        <div className="row">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </section>

      <section className="panel">
        <h2>Input</h2>
        <Input placeholder="Email" type="email" />
      </section>

      <section className="panel">
        <h2>Selection</h2>
        <div className="stack">
          <Checkbox>Accept terms</Checkbox>
          <Switch>Enable notifications</Switch>
        </div>
      </section>

      <section className="panel">
        <h2>Tabs</h2>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="account">Account panel</TabsContent>
          <TabsContent value="password">Password panel</TabsContent>
        </Tabs>
      </section>

      <section className="panel">
        <h2>Dialog</h2>
        <Dialog>
          <DialogTrigger>
            <Button>Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>
              This dialog is powered by the Zeus Web dialog primitive.
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </section>
    </main>
  )
}
