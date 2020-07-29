import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {PageNotFoundComponent} from 'src/app/layout/components/page-not-found/page-not-found.component';
import {AuthGuard} from 'src/app/core/guards/auth.guard';
import {HomeComponent} from 'src/app/modules/home/home.component';

/**
 * This defines the application's routes. All base routes should be lazy loaded.
 * @type {Routes}
 */
export const appRoutes: Routes = [
	{path: '', pathMatch: 'full', component: HomeComponent},
	{path: '**', component: PageNotFoundComponent}
];

@NgModule({
	imports: [RouterModule.forRoot(appRoutes)],
	exports: [RouterModule]
})
export class AppRoutingModule {
}
