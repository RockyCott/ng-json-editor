import { Component } from '@angular/core';

import 'ace-builds';
import 'ace-builds/src-noconflict/mode-json';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'ng-json-editor';
  jsonInputData = '';

  imprimir() {
    console.log(this.jsonInputData);
    console.log(this.isJson(this.jsonInputData));
  }

  // funcion para comprobar si es un json valido
  isJson(str: string) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }
}
