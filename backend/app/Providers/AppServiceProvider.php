<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Recuperação de senha: link abre a tela do app e e-mail em português
        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim(config('app.url'), '/').'/redefinir-senha?'.http_build_query(['token' => $token, 'email' => $user->email]));
        ResetPassword::toMailUsing(fn ($user, string $token) => (new MailMessage)
            ->subject('Redefinir sua senha – Dieta & Treino')
            ->greeting('Oi, '.explode(' ', $user->name)[0].'!')
            ->line('Recebemos um pedido para redefinir a senha da sua conta.')
            ->action('Criar nova senha', rtrim(config('app.url'), '/').'/redefinir-senha?'.http_build_query(['token' => $token, 'email' => $user->email]))
            ->line('O link vale por 60 minutos. Se não foi você, é só ignorar este e-mail.')
            ->salutation('Até já! 💜'));
        //
    }
}
