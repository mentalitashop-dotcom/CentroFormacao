import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlterarPasswordInicialComponent } from './alterar-password-inicial.component';

describe('AlterarPasswordInicialComponent', () => {
  let component: AlterarPasswordInicialComponent;
  let fixture: ComponentFixture<AlterarPasswordInicialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlterarPasswordInicialComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AlterarPasswordInicialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
