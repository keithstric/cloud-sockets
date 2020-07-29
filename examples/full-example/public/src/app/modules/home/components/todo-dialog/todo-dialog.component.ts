import {Component, Inject, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Todo} from '../../interfaces/todo.interface';

@Component({
  selector: 'app-todo-dialog',
  templateUrl: './todo-dialog.component.html',
  styleUrls: ['./todo-dialog.component.scss']
})
export class TodoDialogComponent implements OnInit {
	todo: FormGroup = new FormGroup({
		subject: new FormControl(''),
		text: new FormControl(''),
		id: new FormControl('')
	});

  constructor(
		public dialogRef: MatDialogRef<TodoDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: Todo
	) { }

  ngOnInit(): void {
  	if (this.data) {
  		this.todo.setValue(this.data);
		}
	}

  onSubmit() {
		console.log('onSubmit, todo=', this.todo.value);
		this.dialogRef.close(this.todo.value);
	}

	onCancel() {
		this.dialogRef.close(false);
	}

}
