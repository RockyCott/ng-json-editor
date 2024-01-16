import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import * as ace from 'ace-builds';
// ace.config.set('basePath', 'node_modules/ace-builds/src-noconflict');
ace.config.set('basePath', 'https://unpkg.com/ace-builds/src-noconflict');
import { Ace, edit } from 'ace-builds';

// cargar temas
import 'ace-builds/src-noconflict/theme-tomorrow';
import 'ace-builds/src-noconflict/theme-dracula';

import * as jsonlint from 'jsonlint';

import { jsonrepair } from 'jsonrepair';
/**
 * Represents the EditorComponent class which is responsible for managing the JSON editor.
 * This component provides functionalities for editing, validating, and prettifying JSON content.
 */
@Component({
  selector: 'app-json-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
})
export class EditorComponent
  implements OnInit, AfterViewInit, OnChanges, OnDestroy
{
  /**
   * Reference to the editor element.
   */
  @ViewChild('editor') private editorRef!: ElementRef<HTMLElement>;
  /**
   * Emits an event when the text value changes.
   * @event textChange
   * @type {EventEmitter<string>}
   */
  @Output() private textChange = new EventEmitter<string>();
  /**
   * The input text for the editor component.
   */
  @Input() public text!: string;
  /**
   * Indicates whether the editor is in read-only mode.
   */
  @Input() public readOnly: boolean = false;
  @Input() public mode: string = 'json';
  @Input() public darkMode: boolean = false;
  @Input() customStyles: { [key: string]: string } = {};
  @Input() showToolbar: boolean = true;
  protected showErrors: boolean = true;
  /**
   * Emits an event when the validation state changes.
   *
   * @event validationChange
   * @type {EventEmitter<{ valid: boolean; error: any; }>}
   */
  @Output() validationChange: EventEmitter<{ valid: boolean; error: any }> =
    new EventEmitter<{
      valid: boolean;
      error: any;
    }>();

  editor!: Ace.Editor;

  fontSize: number = 14;

  // All possible options can be found at:
  // https://github.com/ajaxorg/ace/wiki/Configuring-Ace
  options = {
    showPrintMargin: false,
    tabSize: 2,
    wrap: true,
    fontSize: this.fontSize,
    fontFamily: "'Roboto Mono Regular', monospace",
  };

  protected inError = false;

  protected jsonErrorDetails: string = '';

  protected errorPosition: { row: any; column: any } = {
    row: null,
    column: null,
  };

  protected currentPositionCursor: { row: number; column: number } = {
    row: 0,
    column: 0,
  };

  searchText: string = '';

  constructor(private cdr: ChangeDetectorRef) {
    // nothing
  }
  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor?.container?.remove();
  }

  ngOnInit(): void {
    // nothing
  }

  ngAfterViewInit(): void {
    this.initEditor_();
  }

  private onTextChange_(text: string): void {
    this.textChange?.emit(text);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.editor) {
      return;
    }
    for (const propName in changes) {
      if (changes.hasOwnProperty(propName)) {
        switch (propName) {
          case 'text':
            this.onExternalUpdate_();
            break;
          case 'mode':
            this.onEditorModeChange_();
            break;
          case 'readOnly':
            this.editor.setReadOnly(this.readOnly);
            break;
          default:
        }
      }
    }
  }

  private initEditor_(): void {
    this.editor = edit(this.editorRef.nativeElement);
    this.editor.setOptions(this.options);
    this.editor.setValue(this.text, -1);
    this.editor.setReadOnly(this.readOnly);
    this.changeEditorTheme_(this.darkMode ? 'dracula' : 'tomorrow');
    this.setEditorMode_();
    this.editor.setOption('fadeFoldWidgets', true);
    this.editor.on('change', () => this.onEditorTextChange_());
    this.editor.session.selection.on('changeCursor', () =>
      this.onCursorChange_()
    );
    if (this.textHasContent_()) {
      this.isValidJson_();
    }
  }

  private onCursorChange_(): void {
    const point = this.editor.getCursorPosition();
    this.currentPositionCursor = point;
  }

  private onExternalUpdate_(): void {
    const point = this.editor.getCursorPosition();
    this.editor.setValue(this.text, -1);
    this.editor.moveCursorToPosition(point);
  }

  private onEditorTextChange_(): void {
    this.text = this.editor.getValue();
    this.onTextChange_(this.text);
    this.isValidJson_();
  }

  private onEditorModeChange_(): void {
    this.setEditorMode_();
  }

  private setEditorMode_(): void {
    this.editor.getSession().setMode(`ace/mode/${this.mode}`);
  }

  protected changeEditorTheme_(theme: string): void {
    this.editor.setTheme(`ace/theme/${theme}`);
  }

  protected prettifyJson_(): void {
    try {
      const json = JSON.parse(this.text);
      this.text = JSON.stringify(json, null, 2);
      this.onTextChange_(this.text);
    } catch (e) {
      console.error(e);
    }
  }

  private textHasContent_(): boolean {
    return this.text !== '' && this.text !== undefined && this.text !== null;
  }

  private isValidJson_(): boolean {
    try {
      if (this.textHasContent_()) {
        JSON.parse(this.text);
      }
      this.onJsonValidationChange(true, null);
      this.clearErrorAnnotations();
      this.inError = false;
      this.cdr.detectChanges();
    } catch (error: any) {
      const message = error?.message;
      this.onJsonValidationChange(false, message);
      const { row } = this.findErrorPosition(message);
      this.errorPosition = { row, column: 0 };
      this.setEditorAnnotations(row, message);
      this.inError = true;
      this.cdr.detectChanges();
      return false;
    }
    return true;
  }

  private findErrorPosition(message: string): { row: any; column: any } {
    const position = { row: null, column: null };
    const rowErrorPosition = RegExp(/line (\d+)/).exec(message);
    const columnErrorPosition = RegExp(/column (\d+)/).exec(message);
    if (
      rowErrorPosition &&
      rowErrorPosition?.length > 1 &&
      columnErrorPosition &&
      columnErrorPosition?.length > 1
    ) {
      return {
        row: parseInt(rowErrorPosition[1], 10),
        column: parseInt(columnErrorPosition[1], 10),
      };
    }
    return position;
  }

  private onJsonValidationChange(isValid: boolean, errorDetails: any): void {
    if (isValid) {
      this.jsonErrorDetails = '';
    } else {
      this.jsonErrorDetails = errorDetails;
    }

    const validationEvent = { valid: isValid, error: errorDetails };
    this.validationChange.emit(validationEvent);
  }

  private setEditorAnnotations(row: number, message: string): void {
    if (row === null) {
      row = 1;
    }
    if (message === null) {
      message = 'Error in content';
    }
    setTimeout(() => {
      this.editor.getSession().setAnnotations([
        {
          row: row - 1,
          column: 0,
          text: message,
          type: 'error',
        },
      ]);
    });
  }

  private clearErrorAnnotations(): void {
    const session = this.editor.getSession();
    session.clearAnnotations();
    Object.values(session.getMarkers()).forEach((marker) => {
      session.removeMarker(marker.id);
    });
  }

  protected downloadJson_(): void {
    const blob = new Blob([this.text], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = 'data.json';
    anchor.href = url;
    anchor.click();
  }

  /**
   * Toggles the daDownloadrk mode of the editor.
   */
  protected changeDarkMode_(): void {
    this.darkMode = !this.darkMode;
    this.changeEditorTheme_(this.darkMode ? 'dracula' : 'tomorrow');
  }

  /**
   * copiar text al portapapeles
   */
  protected copyContent_(): void {
    navigator.clipboard.writeText(this.text);
  }

  protected repairJson_(): void {
    this.text = jsonrepair(this.text);
    this.onTextChange_(this.text);
    this.prettifyJson_();
  }

  protected setErrorPosition_(): void {
    this.editor.moveCursorToPosition(this.errorPosition);
    this.editor.focus();
    // desplazar el scroll
    const editor = this.editor;
    const range = editor.getSelectionRange();
    const row = range.start.row;
    const column = range.start.column;
    //editor.scrollToLine(row, true, true, () => {});
    editor.gotoLine(row, column, true);
  }

  onFocus_(): void {
    const searchBox = document.querySelector('.search-box');
    const searchIcon = document.querySelector('.search-icon');
    searchBox?.classList.add('border-searching');
    searchIcon?.classList.add('si-rotate');
  }

  onBlur_(): void {
    const searchBox = document.querySelector('.search-box');
    const searchIcon = document.querySelector('.search-icon');
    searchBox?.classList.remove('border-searching');
    searchIcon?.classList.remove('si-rotate');
  }

  onKeyUp_(text: any): void {
    const goIcon = document.querySelector('.go-icon');
    if (text?.length) {
      goIcon?.classList.add('go-in');
    } else {
      goIcon?.classList.remove('go-in');
    }
  }

  public get inErrorState(): boolean {
    return this.inError;
  }

  searchTextChange_(text: string): void {
    if (text.length === 0) {
      this.editor.find(text);
      return;
    }
    this.editor.find(text, {
      backwards: false,
      wrap: true,
      caseSensitive: false,
      wholeWord: false,
      regExp: false,
    });
  }

  uploadFile_(event: any): void {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      this.text = text as string;
      this.onTextChange_(this.text);
      this.prettifyJson_();
    };
    reader.readAsText(file);
  }

  increaseFontSize_(): void {
    this.options.fontSize += 1;
    this.fontSize = this.options.fontSize;
    this.editor.setOptions(this.options);
  }

  decreaseFontSize_(): void {
    if (this.fontSize <= 1) {
      return;
    }
    this.options.fontSize -= 1;
    this.fontSize = this.options.fontSize;
    this.editor.setOptions(this.options);
  }

  resetFontSize_(): void {
    this.options.fontSize = 14;
    this.fontSize = this.options.fontSize;
    this.editor.setOptions(this.options);
  }
}
