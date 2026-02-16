import { TestBed } from '@angular/core/testing';

import { MockFleet } from './mock-fleet.service';

describe('MockFleet', () => {
  let service: MockFleet;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MockFleet);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
