import { Component } from '@angular/core';

@Component({
  selector: 'app-command',
  standalone: true,
  templateUrl: './command.component.html',
  styleUrl: './command.component.css',
})
export class CommandComponent {
  lastAction = 'None';

  dispatchMock() {
    this.lastAction = `Dispatch queued @ ${new Date().toLocaleTimeString()}`;
  }

  stopMock() {
    this.lastAction = `STOP issued @ ${new Date().toLocaleTimeString()}`;
  }
}
