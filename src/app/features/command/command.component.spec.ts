import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Command } from './command.component';

describe('Command', () => {
  let component: Command;
  let fixture: ComponentFixture<Command>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Command]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Command);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
