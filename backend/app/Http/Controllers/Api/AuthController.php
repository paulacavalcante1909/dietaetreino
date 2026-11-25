<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', Password::min(8)],
            'terms' => ['accepted'],
        ], [
            'email.unique' => 'Já existe uma conta com este e-mail.',
            'terms.accepted' => 'É preciso aceitar os Termos de Uso e a Política de Privacidade.',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'password' => $data['password'],
            'terms_accepted_at' => now(),
        ]);

        return response()->json($this->sessionPayload($user), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower($data['email']))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'E-mail ou senha incorretos.',
            ]);
        }

        return response()->json($this->sessionPayload($user));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => $user,
            'goal' => $user->goalFor(now()->toDateString()),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email,'.$user->id],
        ], ['email.unique' => 'Já existe uma conta com este e-mail.']);

        $user->update(['name' => $data['name'], 'email' => strtolower($data['email'])]);

        return response()->json(['user' => $user]);
    }

    /** Preferências do app (ex.: somar calorias do treino à meta do dia). */
    public function updatePreferences(Request $request): JsonResponse
    {
        $data = $request->validate(['add_burned_to_goal' => ['required', 'boolean']]);
        $request->user()->update($data);

        return response()->json(['user' => $request->user()->fresh()]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'string', Password::min(8), 'different:current_password'],
        ], [
            'current_password.current_password' => 'Senha atual incorreta.',
            'password.different' => 'A nova senha deve ser diferente da atual.',
        ]);

        $request->user()->update(['password' => $data['password']]);

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'current_password:sanctum'],
        ], ['password.current_password' => 'Senha incorreta.']);

        $user = $request->user();
        $user->tokens()->delete();
        Storage::disk('local')->deleteDirectory("checkins/{$user->id}"); // fotos dos check-ins
        $user->delete(); // dados relacionados caem por cascade

        return response()->json(['ok' => true]);
    }

    private function sessionPayload(User $user): array
    {
        return [
            'token' => $user->createToken('pwa')->plainTextToken,
            'user' => $user,
            'goal' => $user->goalFor(now()->toDateString()),
        ];
    }
}
