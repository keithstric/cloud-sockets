import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CoreModule} from '../../core/core.module';
import {HomeComponent} from './home.component';
import { TodoDialogComponent } from './components/todo-dialog/todo-dialog.component';

/**
 * The HomeModule
 */
@NgModule({
	declarations: [
		HomeComponent,
		TodoDialogComponent
	],
	imports: [
		CommonModule,
		CoreModule,
		FormsModule,
		ReactiveFormsModule
	]
})
export class HomeModule { }
