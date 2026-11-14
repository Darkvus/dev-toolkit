import { Trash2 } from "lucide-react"

export function Form() {
  return (
    <div>
      <Button size="icon" variant="ghost"><Trash2 /></Button>
      <button><Trash2 /></button>
      <Input name="plate" />
      <img src="/a.png" />
      <div onClick={() => go()}>go</div>
      <p className="outline-none">x</p>
      <Dialog>
        <DialogContent>
          <p>hello</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
