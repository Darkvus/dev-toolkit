import { Trash2 } from "lucide-react"

export function Form() {
  return (
    <div>
      <Button size="icon" variant="ghost" aria-label="Delete item"><Trash2 /></Button>
      <button type="button"><Trash2 /><span className="sr-only">Remove</span></button>
      <Button>Save</Button>
      <FieldLabel htmlFor="plate">Plate</FieldLabel>
      <Input id="plate" name="plate" />
      <Field label="Name"><Input name="name" /></Field>
      <img src="/a.png" alt="" />
      <div role="button" tabIndex={0} onClick={() => go()}>go</div>
      <input className="outline-none focus-visible:ring-2" id="x" />
      <main tabIndex={-1} className="outline-none">x</main>
      <Dialog>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    </div>
  )
}
