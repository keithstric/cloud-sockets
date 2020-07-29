import {Times} from '../../../core/interfaces/times.interface';
import iso_date = Times.iso_date;

export interface Todo {
	id?: number;
	subject: string;
	text: string;
}
