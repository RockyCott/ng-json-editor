import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorComponent } from './editor.component';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [EditorComponent],
  imports: [CommonModule, FormsModule],
  exports: [EditorComponent],
})
export class EditorModule {}
