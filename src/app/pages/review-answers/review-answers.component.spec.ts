import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewAnswersComponent } from './review-answers.component';

describe('ReviewAnswersComponent', () => {
  let component: ReviewAnswersComponent;
  let fixture: ComponentFixture<ReviewAnswersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewAnswersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReviewAnswersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
